// inline, whatever its size: a data URI, rather than a request.
import globe from "./globe.svg?inline";

/**
 * The header's background: globe.svg, a wireframe globe, the orthographic projection of its front half, over Keen's
 * green, as a gradient. They replace the theme's top-green.png, 54 kB that the header waited for on a slow network.
 */
export const HEADER_BACKGROUND = `url("${globe}"), linear-gradient(100deg, #36bb75 0%, #3fd083 100%)`;
