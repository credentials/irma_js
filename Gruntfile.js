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

    var client = grunt.option("client") || false;
    var server = grunt.option("server") || false;
    var examples = grunt.option("examples") || false;
    if (!client && !server && !examples) {
        console.log("INFO: building everything");
        client = server = examples = true;
    }

    console.log("Web server url:", web_server_url);
    console.log("Api server url:", api_server_url);

    var tasks = [];
    var watchTasks = {};
    if (client) {
        tasks.push("browserify:client", "uglify", "copy:bower_bundle");

        watchTasks.clientScripts = {
            files: ["./client/*.js"],
            tasks: ["browserify:client", "uglify"],
        };
    }

    if (server) {
        tasks.push("browserify:server", "sass", "copy:server", "string-replace:server");
        if (!tasks.includes("copy:bower_bundle"))
            tasks.push("copy:bower_bundle");

        watchTasks.serverScripts = {
            files: ["./server/*.js"],
            tasks: ["browserify:server"],
        };
        watchTasks.sass = {
            files: ["./server/**/*.scss"],
            tasks: ["sass"],
        };
        watchTasks.serverhtmlFiles = {
            files: [ "./server/**/*.html" ],
            tasks: ["string-replace"],
        };
        watchTasks.webFiles = {
            files: [ "./server/**/*", "!./server/**/*.{scss,html}", "!./server/**/*.js" ],
            tasks: ["copy"],
        };
    }

    if (examples) {
        tasks.push("copy:examples", "string-replace");

        watchTasks.htmlfiles = {
            files: [ "./examples/**/*.html" ],
            tasks: ["string-replace"],
        };
        watchTasks.exampleScripts = {
            files: ["./examples/*.js"],
            tasks: ["copy"],
        };
    }

    var replacements = [{
        pattern: "<IRMA_WEB_SERVER>",
        replacement: web_server_url,
    }, {
        pattern: "<IRMA_API_SERVER>",
        replacement: api_server_url,
    }];

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
        uglify: {
            client: {
                files: {
                    "./build/client/irma.min.js": ["./build/client/irma.js"],
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
                src: ["**/*", "!**/*.html", "!**/*.js"],
                dest: "build/examples",
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
            server: {
                files: [{
                    cwd: "./",
                    src: ["server/**/*.html"],
                    dest: "build/",
                    expand: "true",
                }],
                options: { replacements: replacements },
            },
            examples: {
                files: [{
                    cwd: "./",
                    src: ["examples/**/*.html", "examples/**/*.js"],
                    dest: "build/",
                    expand: "true",
                }],
                options: { replacements: replacements },
            },
        },
        watch: watchTasks,
    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks("grunt-babel");
    grunt.loadNpmTasks("grunt-sass");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-string-replace");
    grunt.loadNpmTasks("grunt-contrib-uglify");

    grunt.registerTask("default", ["build", "watch"]);
    grunt.registerTask("build", tasks);
};
