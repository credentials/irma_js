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
                    "./build/client/irma.js": ["./client/irma.js"]
                }
            },
            server: {
                files: {
                    "./build/server/irma.js": ["./server/irma.js"]
                }
            }
        },
        copy: {
            client: {
                cwd: "client",
                src: "**/*",
                dest: "build/client",
                expand: "true"
            },
            server : {
                cwd: "server",
                src: "**/*",
                dest: "build/server",
                expand: "true"
            }
        },
        watch: {
            scripts: {
                files: ["./client/*.js"],
                tasks: ["browserify", "copy"]
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
