module.exports = function (grunt) {
    // Setup default url for the irma api server url.
    // These are used to configure the examples (so they can find the authentication server)
    var api_server_url;
    if (typeof(grunt.option("api_server_url")) === "undefined") {
        console.log("INFO: set api_server_url to have working local phone examples");
    }
    api_server_url = grunt.option("api_server_url") || "https://demo.irmacard.org/tomcat/irma_api_server/api/v2/";

    var client = grunt.option("client") || false;
    var examples = grunt.option("examples") || false;
    if (!client && !examples) {
        console.log("INFO: building everything");
        client = examples = true;
    }

    console.log("Api server url:", api_server_url);

    var tasks = [];
    var watchTasks = {};
    if (client) {
        tasks.push("browserify:client", "uglify", "copy:bower_bundle", "sass");

        watchTasks.clientScripts = {
            files: ["./client/*.js"],
            tasks: ["browserify:client", "uglify"],
        };
        watchTasks.sass = {
            files: ["./client/**/*.scss"],
            tasks: ["sass"],
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
            client: {
                files: {
                    "./build/client/irma.css": "client/sass/irma.scss",
                }
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
                src: ["**/*", "!**/*.js"],
                dest: "build/examples",
                expand: "true",
            },
        },
        "string-replace": {
            examples: {
                files: [{
                    cwd: "./",
                    src: ["examples/**/*.js"],
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
