module.exports = function (grunt) {
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
                files: {
                    "./build/client/bundle.js": ["./client/demo.js"]
                }
            },
            server: {
                files: {
                    "./build/server/bundle.js": ["./server/irma.js"]
                }
            }
        },
        copy: {
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
            webfiles: {
                files: ["./{client,server}/**/*", "!./{client,server}/**/*.{js|scss}"],
                tasks: ["copy"]
            }
        }
    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks("grunt-babel");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-contrib-copy");

    grunt.registerTask("default", ["watch"]);
    grunt.registerTask("build", ["browserify", "copy"]);
};
