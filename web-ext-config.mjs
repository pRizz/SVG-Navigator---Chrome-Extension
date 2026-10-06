export default {
    // Bundled dev build from `pnpm build:dev`. Raw `src` can't be loaded directly
    // because its scripts use ES `import`/`export`, which content scripts don't support.
    sourceDir: '.build/firefox',

    // Artifacts directory where built files will be saved
    artifactsDir: 'web-ext-artifacts',

    // Files to ignore when building
    ignoreFiles: [
        'tests/**/*',
        'docs/**/*',
        '**/*.log',
        '**/.DS_Store',
        '**/*.map'
    ],

    // Build settings
    build: {
        overwriteDest: true,
    },

    // Settings for the run command
    run: {
    // Which browser to run
        target: ['firefox-desktop'],
        // Firefox specific settings
        firefox: 'firefox',
        // Firefox profile to use
        startUrl: ['https://upload.wikimedia.org/wikipedia/commons/1/17/World.svg']
    },

    // Lint settings
    lint: {
        warningsAsErrors: false,
        selfHosted: false
    }
};