import {inc, report, init, startAuthentication} from "./irma.js";

console.log("Hello hello");

export function start() {
    console.log("Starting auth using IRMA");
    startAuthentication();
}

init();
