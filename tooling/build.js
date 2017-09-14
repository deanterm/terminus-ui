'use strict';

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const camelCase = require('camelcase');
const ngc = require('@angular/compiler-cli/src/main').main;
const rollup = require('rollup');
const uglify = require('rollup-plugin-uglify');
const sourcemaps = require('rollup-plugin-sourcemaps');
const execa = require('execa');
const inlineResources = require('./inline-resources');
const mergeFiles = require('merge-files');
const absModuleFix = require('rollup-plugin-absolute-module-fix');

const libNameWithScope = require('./../package.json').name;
const libName = libNameWithScope.slice(libNameWithScope.indexOf('/') + 1);
const rootFolder = path.join(__dirname, '../');
const compilationFolder = path.join(rootFolder, 'out-tsc');
const srcFolder = path.join(rootFolder, 'src/lib');
const distFolder = path.join(rootFolder, 'dist');
const tempLibFolder = path.join(compilationFolder, 'lib');
const es5OutputFolder = path.join(compilationFolder, 'lib-es5');
const es2015OutputFolder = path.join(compilationFolder, 'lib-es2015');

/*
 * Define all SCSS files that need to be exposed to the consuming library
 * NOTE: Typography must be before `_spacing.scss`
 */
const scssHelpersInputPathList = [
  'src/lib/src/scss/helpers/_typography.scss',
  'src/lib/src/scss/helpers/_color.scss',
  'src/lib/src/scss/helpers/_assets.scss',
  'src/lib/src/scss/helpers/_breakpoints.scss',
  'src/lib/src/scss/helpers/_layout.scss',
  'src/lib/src/scss/helpers/_z-index.scss',
  'src/lib/src/scss/helpers/_spacing.scss',
  'src/lib/src/scss/helpers/_animation.scss',
];
const scssHelpersOutputPath = 'src/lib/helpers.scss';


return Promise.resolve()
  // Copy library to temporary folder, compile sass files and inline html/css.
  .then(() => _relativeCopy(`**/*`, srcFolder, tempLibFolder)
    .then(() => compileSassFiles())
    .then(() => inlineResources(tempLibFolder))
    .then(() => console.log('Inlining succeeded.'))
  )
  // Compile to ES2015.
  .then(() => ngc({ project: `${tempLibFolder}/tsconfig.json` })
    .then(exitCode => exitCode === 0 ? Promise.resolve() : Promise.reject())
    .then(() => console.log('ES2015 compilation succeeded.'))
  )
  // Compile to ES5.
  .then(() => ngc({ project: `${tempLibFolder}/tsconfig.es5.json` })
    .then(exitCode => exitCode === 0 ? Promise.resolve() : Promise.reject())
    .then(() => console.log('ES5 compilation succeeded.'))
  )
  // Copy typings and metadata to `dist/` folder.
  .then(() => Promise.resolve()
    .then(() => _relativeCopy('**/*.d.ts', es2015OutputFolder, distFolder))
    .then(() => _relativeCopy('**/*.metadata.json', es2015OutputFolder, distFolder))
    .then(() => console.log('Typings and metadata copy succeeded.'))
  )
  // Bundle lib.
  .then(() => {
    // Base configuration.
    const es5Entry = path.join(es5OutputFolder, `${libName}.js`);
    const es2015Entry = path.join(es2015OutputFolder, `${libName}.js`);
    const rollupBaseConfig = {
      moduleName: camelCase(libName),
      sourceMap: true,
      // ATTENTION:
      // Add any dependency or peer dependency your library has to `globals` and `external`.
      // This is required for UMD bundle users.
      globals: {
        // The key here is library name, and the value is the the name of the global variable name
        // the window object.
        // See https://rollupjs.org/#javascript-api for more.
        // Angular dependencies
        '@angular/animations': 'ng.animations',
        '@angular/animations/browser': 'ng.animations.browser',
        '@angular/core': 'ng.core',
        '@angular/common': 'ng.common',
        '@angular/flex-layout': 'ng.flex-layout',
        '@angular/forms': 'ng.forms',
        '@angular/http': 'ng.http',
        '@angular/router': 'ng.router',
        '@angular/platform-browser': 'ng.platformBrowser',
        '@angular/platform-browser/animations': 'ng.platformBrowser.animations',
        '@angular/platform-browser-dynamic': 'ng.platformBrowserDynamic',
        '@angular/material': 'ng.material',

        // Rxjs dependencies
        'rxjs/Subject': 'Rx',
        'rxjs/Observable': 'Rx',
        'rxjs/add/observable/of': 'Rx.Observable',
        'rxjs/add/observable/fromEvent': 'Rx.Observable',
        'rxjs/add/operator/distinctUntilChanged': 'Rx.Operator',
        'rxjs/add/operator/pluck': 'Rx.Operator',
        'rxjs/add/operator/debounceTime': 'Rx.Operator',
        'rxjs/BehaviorSubject': 'Rx.BehaviorSubject',
      },
      external: [
        // List of dependencies
        // See https://rollupjs.org/#javascript-api for more.
        '@angular/core',
        '@angular/common',
        '@angular/animations',
        '@angular/animations/browser',
        '@angular/flex-layout',
        '@angular/forms',
        '@angular/http',
        '@angular/router',
        '@angular/platform-browser',
        '@angular/platform-browser/animations',
        '@angular/platform-browser-dynamic',
        '@angular/material',
        '@angular/cdk/portal',
        'rxjs/Subject',
        'rxjs/Observable',
        'rxjs/add/observable/of',
        'rxjs/add/observable/fromEvent',
        'rxjs/add/operator/distinctUntilChanged',
        'rxjs/add/operator/pluck',
        'rxjs/add/operator/debounceTime',
        'rxjs/BehaviorSubject',
        // NOTE: I would prefer this library to be bundled with terminus/ui. However, doing so
        // breaks the build. We need the commonjs rollup plugin to include this library, but adding
        // the commonjs plugin seems to break other @angular core includes.
        'angular2-ladda',
      ],
      plugins: [
        sourcemaps(),
        absModuleFix(),
      ],
      onwarn: function(warning) {
        // Suppress this error message... there are hundreds of them. Angular team says to ignore it.
        // https://github.com/rollup/rollup/wiki/Troubleshooting#this-is-undefined
        if (warning.code === 'THIS_IS_UNDEFINED') {
          return;
        }
        console.error(warning.message);
      }
    };

    // UMD bundle.
    const umdConfig = Object.assign({}, rollupBaseConfig, {
      entry: es5Entry,
      dest: path.join(distFolder, `bundles`, `${libName}.umd.js`),
      format: 'umd',
    });

    // Minified UMD bundle.
    const minifiedUmdConfig = Object.assign({}, rollupBaseConfig, {
      entry: es5Entry,
      dest: path.join(distFolder, `bundles`, `${libName}.umd.min.js`),
      format: 'umd',
      plugins: rollupBaseConfig.plugins.concat([uglify({})])
    });

    // ESM+ES5 flat module bundle.
    const fesm5config = Object.assign({}, rollupBaseConfig, {
      entry: es5Entry,
      dest: path.join(distFolder, `${libName}.es5.js`),
      format: 'es'
    });

    // ESM+ES2015 flat module bundle.
    const fesm2015config = Object.assign({}, rollupBaseConfig, {
      entry: es2015Entry,
      dest: path.join(distFolder, `${libName}.js`),
      format: 'es'
    });

    const allBundles = [
      umdConfig,
      minifiedUmdConfig,
      fesm5config,
      fesm2015config
    ].map(cfg => rollup.rollup(cfg).then(bundle => bundle.write(cfg)));

    return Promise.all(allBundles)
      .then(() => console.log('All bundles generated successfully.'))
  })
  // Copy package files
  .then(() => Promise.resolve()
    .then(() => _relativeCopy('LICENSE', rootFolder, distFolder))
    .then(() => _relativeCopy('package.json', rootFolder, distFolder))
    .then(() => _relativeCopy('README.md', rootFolder, distFolder))
    .then(() => console.log('Package files copy succeeded.'))
  )
  .then(() => Promise.resolve()
    .then(() => mergeFiles(scssHelpersInputPathList, scssHelpersOutputPath))
    .then(() => _relativeCopy('helpers.scss', srcFolder, distFolder))
    .then(() => console.log('SCSS helpers merged and copied.'))
  )
  // Generate CSS for shared styles
  .then(() => Promise.resolve()
    .then(() => compileGeneratedCss())
    .then(() => console.log('Generated CSS created.'))
  )
  .catch(e => {
    console.error('\Build failed. See below for errors.\n');
    console.error(e);
    process.exit(1);
  });


// Copy files maintaining relative paths.
function _relativeCopy(fileGlob, from, to) {
  return new Promise((resolve, reject) => {
    glob(fileGlob, { cwd: from, nodir: true }, (err, files) => {
      if (err) reject(err);
      files.forEach(file => {
        const origin = path.join(from, file);
        const dest = path.join(to, file);
        const data = fs.readFileSync(origin, 'utf-8');
        _recursiveMkDir(path.dirname(dest));
        fs.writeFileSync(dest, data);
        resolve();
      })
    })
  });
}

// Recursively create a dir.
function _recursiveMkDir(dir) {
  if (!fs.existsSync(dir)) {
    _recursiveMkDir(path.dirname(dir));
    fs.mkdirSync(dir);
  }
}

function compileSassFiles() {
  return execa('node-sass', [
    tempLibFolder,
    '-o', tempLibFolder,
    '--output-style',
    'compressed',
    '--source-map',
    true,
    '--source-map-contents'
  ]);
}

function compileGeneratedCss() {
  return execa('node-sass', [
    ['src/lib/src/scss/global/terminus-ui.scss'],
    '-o', './dist',
    '--output-style',
    'compressed',
    '--source-map',
    true,
    '--source-map-contents'
  ]);
}

