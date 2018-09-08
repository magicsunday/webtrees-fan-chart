/**
 * Get the inner radius depending on the depth of an element.
 *
 * @param {Object} data D3 data object
 *
 * @returns {Number}
 */
export function innerRadius(data) {
    if (data.depth === 0) {
        return 0;
    }

    if (data.depth < rso.options.numberOfInnerCircles) {
        return ((data.depth - 1) * (rso.options.innerArcHeight + rso.options.circlePadding))
            + rso.options.centerCircleRadius;
    }

    return ((rso.options.numberOfInnerCircles - 1) * (rso.options.innerArcHeight + rso.options.circlePadding))
        + ((data.depth - rso.options.numberOfInnerCircles) * (rso.options.outerArcHeight + rso.options.circlePadding))
        + rso.options.centerCircleRadius;
}

/**
 * Get the outer radius depending on the depth of an element.
 *
 * @param {Object} data D3 data object
 *
 * @returns {Number}
 */
export function outerRadius(data) {
    if (data.depth === 0) {
        return rso.options.centerCircleRadius;
    }

    if (data.depth <  rso.options.numberOfInnerCircles) {
        return ((data.depth - 1) * (rso.options.innerArcHeight + rso.options.circlePadding))
            + rso.options.innerArcHeight + rso.options.centerCircleRadius;
    }

    return ((rso.options.numberOfInnerCircles - 1) * (rso.options.innerArcHeight + rso.options.circlePadding))
        + ((data.depth - rso.options.numberOfInnerCircles) * (rso.options.outerArcHeight + rso.options.circlePadding))
        + rso.options.outerArcHeight + rso.options.centerCircleRadius;
}

/**
 * Get the center radius.
 *
 * @param {Object} data D3 data object
 *
 * @returns {Number}
 */
export function centerRadius(data) {
    return (innerRadius(data) + outerRadius(data)) / 2;
}

/**
 * Get an radius relative to the outer radius adjusted by the given
 * position in percent.
 *
 * @param {Object} data     D3 data object
 * @param {Number} position Percent offset (0 = inner radius, 100 = outer radius)
 *
 * @returns {number}
 */
export function relativeRadius(data, position) {
    const outer = outerRadius(data);
    return outer - ((100 - position) * (outer - innerRadius(data)) / 100);
}
