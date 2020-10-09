import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import postcss from 'rollup-plugin-postcss'
import babel from '@rollup/plugin-babel'
import license from 'rollup-plugin-license'

const pkg = require('./package.json')

const banner = [
  '/**',
  '\n * Parvus',
  '\n *',
  '\n * @author ', pkg.author,
  '\n * @version ', pkg.version,
  '\n * @url ', pkg.homepage,
  '\n *',
  '\n * ', pkg.license, ' license',
  '\n */'].join('')

let rollupBuilds

/**
 * Build JavaScript
 *
 */
if (process.env.BUILDJS) {
  rollupBuilds = [{
    input: './src/js/parvus.js',
    output: [
      {
        format: 'umd',
        file: './dist/js/parvus.js',
        name: 'parvus'
      },
      {
        format: 'umd',
        file: './dist/js/parvus.min.js',
        name: 'parvus',
        plugins: [
          terser()
        ]
      }
    ],
    plugins: [
      resolve({
        browser: true
      }),
      commonjs(),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**',
        presets: [
          ['@babel/preset-env', {
            corejs: 3.6,
            useBuiltIns: 'usage'
          }]
        ]
      }),
      license({
        banner
      })
    ],
    watch: {
      clearScreen: false
    }
  }]
}

/**
 * Build CSS
 *
 */
if (process.env.BUILDCSS) {
  rollupBuilds = [{
    input: './src/scss/parvus.scss',
    output: [
      {
        file: './dist/css/parvus.css',
        format: 'es'
      }
    ],
    plugins: [
      resolve({
        browser: true
      }),
      commonjs(),
      postcss({
        extract: true,
        plugins: [
          require('postcss-preset-env')
        ]
      }),
      license({
        banner
      })
    ],
    watch: {
      clearScreen: false
    }
  },
  {
    input: './src/scss/parvus.scss',
    output: [
      {
        file: './dist/css/parvus.min.css',
        format: 'es'
      }
    ],
    plugins: [
      resolve({
        browser: true
      }),
      commonjs(),
      postcss({
        extract: true,
        minimize: true,
        plugins: [
          require('postcss-preset-env')
        ]
      }),
      license({
        banner
      })
    ],
    watch: {
      clearScreen: false
    }
  }]
}

export default rollupBuilds