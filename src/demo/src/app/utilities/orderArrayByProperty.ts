/**
 * Order an array alphabetically by property
 *
 * @param {Array} items The array of objects to sort
 * @return {String} timeAgo The difference in time
 */
export default function orderArrayByProperty(items: any[], property: string, isDescending: boolean = true): any[] {
  return items.sort((a: string, b: string) => {
    const nonAlphaRegex = /\W+/g;

    // Check for existence and lowercase
    const aProp = a[property] ? a[property].toLowerCase().replace(nonAlphaRegex, '') : null;
    const bProp = b[property] ? b[property].toLowerCase().replace(nonAlphaRegex, '') : null;

    // Sort ascending or descending
    const aIsFirstReturn = isDescending ? -1 : 1;
    const bIsFirstReturn = isDescending ? 1 : -1;

    if (aProp < bProp) {
      // Sort ascending
      return aIsFirstReturn;
    } else if (aProp > bProp) {
      // Sort descending
      return bIsFirstReturn;
    } else {
      // Do not sort
      return 0;
    }
  });
}
