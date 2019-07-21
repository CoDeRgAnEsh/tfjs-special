import nodeResolve from 'rollup-plugin-node-resolve';
import {terser} from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';

const LICENSE = `/*
* Copyright (c) 2019, Andreas Madsen
* All rights reserved.
*
* Cephes is LICENSED with special permision under BSD.
* Copyright (c) 2019, Steven Moshier
* All rights reserved.
*
*/`;

function config({plugins = [], output = {}}) {
    return {
        input: 'src/index.ts',
        plugins: [
            typescript({
                tsconfigOverride: {compilerOptions: {module: 'ES2015'}}
            }),
            nodeResolve(),
            ...plugins
        ],
        output: {
            banner: LICENSE,
            sourcemap: true,
            globals: {'@tensorflow/tfjs-core': 'tf'},
            ...output
        },
        external: ['@tensorflow/tfjs-core']
    };
}

module.exports = function (cmdOptions) {
    const bundles = [];

    // tf-core.js
    bundles.push(config({
        output: {
            format: 'umd',
            name: 'tf',
            extend: true,
            file: 'dist/tf-math-special.js',
        }
    }));

    // tf-core.min.js
    bundles.push(config({
        plugins: [terser({
            output: { preamble: LICENSE }
        })],
        output: {
            format: 'umd',
            name: 'tf',
            extend: true,
            file: 'dist/tf-math-special.min.js',
        }
    }));

    // tf-core.esm.js
    bundles.push(config({
        plugins: [terser({
            output: { preamble: LICENSE }
        })],
        output: {
            format: 'es',
            file: 'dist/tf-math-special.esm.js',
        }
    }));

    return bundles;
};