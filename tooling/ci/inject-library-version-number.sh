#!/bin/bash

#
# Inject the new package version number in the demo build
#

PLACEHOLDER="0.0.0-PLACEHOLDER"
VERSION_OUTPUT="$(yarn info @terminus/ui version)"
VERSION_NUMBER="$(echo "$VERSION_OUTPUT" | egrep -o ' [[:digit:]]+\.[[:digit:]]+\.[[:digit:]]+')"
VERSION_TRIMMED="$(echo -e "$VERSION_NUMBER" | tr -d '[:space:]')"

echo "Updating library version to: $VERSION_TRIMMED"

# Replace the placeholder text with the library version in all demo app files
grep -rl $PLACEHOLDER 'dist/app' | xargs sed -i'' -e 's|'$PLACEHOLDER'|'"$VERSION_TRIMMED"'|g'

# Delete edit reference files left over from the sed replacement
# NOTE: The force flag is required so that the build isn't cancelled if these files don't exist
rm -f dist/app/*-e
