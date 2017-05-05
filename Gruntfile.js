module.exports = function (grunt) {
    // Setup default urls for the irma web server, and irma api server urls
    // these are used to configure the server pages (so it can find
    // the API) and the examples (so they can find the authentication server)
    var server_url, web_server_url, api_server_url;
    if ( (typeof(grunt.option("server_url")) === "undefined" &&
        (typeof(grunt.option("web_server_url")) === "undefined" ||
         typeof(grunt.option("api_server_url")) === "undefined") )) {
        console.log("INFO: either set server_url, or web_server_url and" +
                    " api_server_url to have working local phone examples");
    }
    server_url = grunt.option("server_url") || "https://demo.irmacard.org/tomcat/irma_api_server/";
    web_server_url = grunt.option("web_server_url") || server_url + "server/";
    api_server_url = grunt.option("api_server_url") || server_url + "api/v2/";

    console.log("Web server url:", web_server_url);
    console.log("Api server url:", api_server_url);

    grunt.initConfig({
        browserify: {
            options: {
                transform: [
                    [
                        "babelify",
                        {
                            presets: ["es2015"],
                        },
                    ],
                ],
            },
            client: {
                options: {
                    browserifyOptions: {
                        standalone: "IRMA",
                    },
                },
                files: {
                    "./build/client/irma.js": ["./client/irma.js"],
                },
            },
            server: {
                files: {
                    "./build/server/bundle.js": ["./server/irma.js"],
                },
            },
        },
        sass: {
            options: {
                sourcemap: false,
                compress: false,
                yuicompress: false,
                style: "expanded",
                includePaths: ["bower_components/compass-mixins/lib"],
            },
            server: {
                files: {
                    "./build/server/css/irma.css": "server/sass/irma.scss",
                },
            },
        },
        copy: {
            // Copying the bower bundles is a bit of a hack
            bower_bundle: {
                cwd: "bower_components",
                src: ["**/*"],
                dest: "build/bower_components",
                expand: "true",
            },
            examples: {
                cwd: "examples",
                src: ["**/*", "!**/*.html"],
                dest: "build/examples",
                expand: "true",
            },
            client: {
                cwd: "client",
                src: ["**/*", "!**/*.{js,scss,html}"],
                dest: "build/client",
                expand: "true",
            },
            server: {
                cwd: "server",
                src: ["**/*", "!**/*.{js,scss,html}"],
                dest: "build/server",
                expand: "true",
            },
        },
        "string-replace": {
            examples: {
                files: [{
                    cwd: "./",
                    src: ["{client,server,examples}/**/*.html"],
                    dest: "build/",
                    expand: "true",
                }],
                options: {
                    replacements: [{
                        pattern: "<IRMA_WEB_SERVER>",
                        replacement: web_server_url,
                    }, {
                        pattern: "<IRMA_API_SERVER>",
                        replacement: api_server_url,
                    }],
                },
            },
        },
        watch: {
            scripts: {
                files: ["./{client,server}/*.js"],
                tasks: ["browserify"],
            },
            sass: {
                files: ["./{client,server}/**/*.scss"],
                tasks: ["sass"],
            },
            webfiles: {
                files: [
                    "./{client,server}/**/*",
                    "./examples/**/*",
                    "!./{client,server,examples}/**/*.{scss,html}",
                    "!./{client,server}/**/*.js",
                ],
                tasks: ["copy"],
            },
            htmlfiles: {
                files: [
                    "./{client,server,examples}/**/*.html",
                ],
                tasks: ["string-replace"],
            },
        },
    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks("grunt-babel");
    grunt.loadNpmTasks("grunt-sass");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-string-replace");

    grunt.registerTask("default", ["string-replace", "watch"]);
    grunt.registerTask("build", ["browserify", "sass", "copy", "string-replace"]);
};
