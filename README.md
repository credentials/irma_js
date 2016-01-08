IRMA JavaScript client
======================

*For now this project is under heavy development, and should not yet be deployed.*

This project contains all the web sources to interact with a verification API. It contains three parts:

 * `client`: The IRMA JavaScript library that you can use on your website if you want to integrate IRMA verification.
 * `examples`: Example pages that use various aspects of the IRMA JavaScript library
 * `server`: The verification pages shown by the verification server.

If you want to use IRMA on your own pages we recommend you use an existing verification server and rely on the examples in the `examples` directory to guide you. *FIXME: More extensive examples!*

## Development

Some notes on development

## Quick start

First setup the development environment:

    npm install -g grunt-cli
    npm install -g bower
    npm install compass     # unchecked

by installing grunt and bower. Then run

    npm install
    bower install

to install the node dependencies and JavaScript libraries. Finally run

    grunt build

to build the libraries and examples. See below for how to setup server URLs for a remote verification server or a local verification server. Alternatively, you can just run

    grunt

to keep rebuilding the files as they change. (Make sure that you run `grunt build` at least once to make sure everything gets build, or just run `grunt build watch` to build and keep building.)

## URLs for verification pages and verification apis

This project relies on two URLs for verifications:

 * The examples depend on the url of the verification server, they use it to communicate with the verification server. To set the verification server's url using grunt, specify it using the `--verification_server_url=<URL>` option.
 * The verification server pages need to know the location of the verification API backend to perform the actual verifications. To set the api's url using grunt, specify it using the `--verification_api_url=<URL>` option.

Note that you only need the latter if you are working on the server pages. If this is the case, you might also be interested the shortcut when you run a local verification server as explained next.

## Running a local verification server

If you are running a local verification server using the `irma_verification_server` project you might as well use it to host the web pages as well (and thus avoid CORS problems). First, make sure that the assembled output is written to the `webapp` directory. If `irma_verification_server` is in the same directory is `irma_js` run:

    ln -s ../irma_verification_server/src/main/webapp/ build

Then simply specify the root of the servlet when running grunt:

     grunt --server_url="http://<HOST>:8080/irma_verification_server/"

If you want to test your application using an external token, make sure that `<HOST>` is either is an ip address that the token can reach, or is resolvable to one by the token. You can then run the example by visiting

    http://<HOST>:8080/irma_verification_server/examples/custom-button.html
