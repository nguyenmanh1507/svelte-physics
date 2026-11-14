# Third-party code and assets

## Code

The water simulation in `src/lib/water/` is ported from **Minamo**
(https://github.com/kanaworksai-hue/minamo), © 東京AI映像合同会社, MIT license.
The files are kept close to the originals; changes are limited to import paths,
asset paths and default parameters.

- [three.js](https://threejs.org) (MIT), installed from npm.

## Assets

Files in `static/underwater/` come from [Poly Haven](https://polyhaven.com) under
**CC0** ([license](https://polyhaven.com/license)), as processed by Minamo.

| Asset                                       | Type    | Used as     | Source                                                       |
| ------------------------------------------- | ------- | ----------- | ------------------------------------------------------------ |
| Kloofendal 48d Partly Cloudy (Pure Sky), 4k | HDRI    | sky and sun | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky |
| Coast Sand 01, 2k                           | texture | seabed sand | https://polyhaven.com/a/coast_sand_01                        |
