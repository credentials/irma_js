module.exports = function (grunt) {
    // Setup default urls for authentication server, and authentication_api urls
    // these are used to configure the authentication server pages (so it can find
    // the API) and the examples (so they can find the authentication server)
    var authentication_server_url, authentication_api_url, server_url;
    if( (typeof(grunt.option("server_url")) === "undefined" &&
        (typeof(grunt.option("authentication_server_url")) === "undefined" ||
         typeof(grunt.option("authentication_api_url")) === "undefined") )) {
        console.log("INFO: either set server_url, or authentication_server_url and" +
                    " authentication_api_url to have working local phone examples");
    }
    server_url = grunt.option("server_url") || "http://localhost:8080/irma_verification_server/";
    authentication_server_url = grunt.option("authentication_server_url") || server_url + "server/";
    authentication_api_url = grunt.option("authentication_api_url") || server_url +  "api/v1/";

    console.log("Authentication server url:", authentication_server_url);
    console.log("Authentication API url:", authentication_api_url);

    grunt.initConfig({
        browserify: {
            options: {
                transform: [
                    [
                        "babelify",
                        {
                            presets: ["es2015"]
                        }
                    ]
                ]
            },
            client: {
                options: {
                    browserifyOptions: {
                        standalone: "IRMA"
                    }
                },
                files: {
                    "./build/client/irma.js": ["./client/irma.js"]
                }
            },
            server: {
                files: {
                    "./build/server/bundle.js": ["./server/irma.js"]
                }
            }
        },
        sass: {
            options: {
                sourcemap: false,
                compress: false,
                yuicompress: false,
                style: 'expanded',
                includePaths: ["bower_components/compass-mixins/lib"],
            },
            server: {
                files: {
                    "./build/server/css/irma.css": "server/sass/irma.scss"
                }
            }
        },
        copy: {
            // Copying the bower bundles is a bit of a hack
            bower_bundle: {
                cwd: "bower_components",
                src: ["**/*"],
                dest: "build/bower_components",
                expand: "true"
            },
            examples: {
                cwd: "examples",
                src: ["**/*", "!**/*.{html}"],
                dest: "build/examples",
                expand: "true"
            },
            client: {
                cwd: "client",
                src: ["**/*", "!**/*.{js,scss,html}"],
                dest: "build/client",
                expand: "true"
            },
            server: {
                cwd: "server",
                src: ["**/*", "!**/*.{js,scss,html}"],
                dest: "build/server",
                expand: "true"
            }
        },
        'string-replace': {
            examples: {
                files: [{
                    cwd: "./",
                    src: ["{client,server,examples}/**/*.html"],
                    dest: "build/",
                    expand: "true"
                }],
                options: {
                    replacements: [{
                        pattern: '<IRMA_VERIFICATION_SERVER>',
                        replacement: authentication_server_url
                    }, {
                        pattern: '<IRMA_VERIFICATION_API>',
                        replacement: authentication_api_url
                    }]
                }
            }
        },
        watch: {
            scripts: {
                files: ["./{client,server}/*.js"],
                tasks: ["browserify"]
            },
            sass: {
                files: ["./{client,server}/**/*.scss"],
                tasks: ["sass"]
            },
            webfiles: {
                files: [
                    "./{client,server}/**/*",
                    "./examples/**/*",
                    "!./{client,server,examples}/**/*.{js,scss,html}",
                ],
                tasks: ["copy"]
            },
            htmlfiles: {
                files: [
                    "./{client,server,examples}/**/*.html"
                ],
                tasks: ["string-replace"]
            }
        }
    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks("grunt-babel");
    grunt.loadNpmTasks("grunt-sass");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-string-replace");

    grunt.registerTask("default", ["watch"]);
    grunt.registerTask("build", ["browserify", "sass", "copy", "string-replace"]);
};
