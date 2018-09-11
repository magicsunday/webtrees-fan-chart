/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
import { config } from "./config";

const minHeight = 500;
const padding   = 10;   // Padding around view box

/**
 * Update/Calculate the viewBox attribute of the SVG element.
 *
 * @public
 */
export function updateViewBox() {
    // Get bounding boxes
    let svgBoundingBox    = config.visual.node().getBBox();
    let clientBoundingBox = config.parent.node().getBoundingClientRect();

    // View box should have at least the same width/height as the parent element
    let viewBoxWidth  = Math.max(clientBoundingBox.width, svgBoundingBox.width);
    let viewBoxHeight = Math.max(clientBoundingBox.height, svgBoundingBox.height, minHeight);

    // Calculate offset to center chart inside svg
    let offsetX = (viewBoxWidth - svgBoundingBox.width) / 2;
    let offsetY = (viewBoxHeight - svgBoundingBox.height) / 2;

    // Adjust view box dimensions by padding and offset
    let viewBoxLeft = Math.ceil(svgBoundingBox.x - offsetX - padding);
    let viewBoxTop  = Math.ceil(svgBoundingBox.y - offsetY - padding);

    // Final width/height of view box
    viewBoxWidth  = Math.ceil(viewBoxWidth + (padding * 2));
    viewBoxHeight = Math.ceil(viewBoxHeight + (padding * 2));

    // Set view box attribute
    config.svg
        .attr("viewBox", [
            viewBoxLeft,
            viewBoxTop,
            viewBoxWidth,
            viewBoxHeight
        ]);

    // Adjust rectangle position
    config.svg
        .select("rect")
        .attr("x", viewBoxLeft)
        .attr("y", viewBoxTop);
}
