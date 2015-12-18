module.exports = function (grunt) {
    var server = grunt.option("server") || "http://localhost:9090";
    var apiServer = grunt.option("apiServer") || "http://localhost:8080";
    console.log("Server set to: ", server);

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
                src: ["**/*"],
                dest: "build/examples",
                expand: "true"
            },
            client: {
                cwd: "client",
                src: ["**/*", "!**/*.{js,scss}"],
                dest: "build/client",
                expand: "true"
            },
            server: {
                cwd: "server",
                src: ["**/*", "!**/*.{js,scss}"],
                dest: "build/server",
                expand: "true"
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
                    "!./{client,server}/**/*.{js|scss}",
                    "./examples/**/*"
                ],
                tasks: ["copy"]
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
    grunt.registerTask("build", ["browserify", "sass", "copy"]);
};
