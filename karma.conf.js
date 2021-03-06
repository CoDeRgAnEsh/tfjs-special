
module.exports = function(config) {
  const args = [];
  if (config.grep) {
    args.push('--grep', config.grep);
  }
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine', 'karma-typescript'],

    // Typescript configuration, not that coverage instrumentation must be on,
    // for the source mapping to work correctly.
    karmaTypescriptConfig: {
      tsconfig: 'tsconfig.json',
      coverageOptions: process.env.KARMA_COVERAGE ? { exclude: /_test\.ts$/ } : {},
      reports: process.env.KARMA_COVERAGE ? {html: 'coverage', 'text-summary': ''} : {},
      exclude: ["node_modules"],
      bundlerOptions: {sourceMap: true}
    },

    // list of files / patterns to load in the browser
    files: [
      {pattern: 'src/**/*.ts'},
      {pattern: 'src/*.ts'}
    ],


    // list of files / patterns to exclude
    exclude: [],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'src/**/*.ts': ['karma-typescript'],
      'src/*.ts': ['karma-typescript']
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress', 'karma-typescript'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Chrome'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,

    //
    client: {jasmine: {random: false}, args: args}
  })
}
