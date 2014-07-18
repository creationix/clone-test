"use strict";

// Detect if the browser supports ES6 generators
window.hasgens = (function*(){yield true;})().next().value;
