import {inc, report, startAuthentication} from "./irma.js";

inc();
inc();
inc();
inc();
report();

console.log("Hello hello");

function start() {
    console.log("Starting auth using IRMA");
    startAuthentication();
}

console.log("Starting auth now");
start();
