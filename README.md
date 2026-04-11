[![Latest version](https://img.shields.io/github/v/release/magicsunday/webtrees-fan-chart?sort=semver)](https://github.com/magicsunday/webtrees-fan-chart/releases/latest)
[![License](https://img.shields.io/github/license/magicsunday/webtrees-fan-chart)](https://github.com/magicsunday/webtrees-fan-chart/blob/main/LICENSE)
[![CI](https://github.com/magicsunday/webtrees-fan-chart/actions/workflows/ci.yml/badge.svg)](https://github.com/magicsunday/webtrees-fan-chart/actions/workflows/ci.yml)


<!-- TOC -->
* [Fan chart](#fan-chart)
  * [Installation](#installation)
    * [Manual installation](#manual-installation)
    * [Using Composer](#using-composer)
    * [Using Git](#using-git)
  * [Update](#update)
  * [Configuration](#configuration)
  * [Usage](#usage)
  * [Troubleshooting](#troubleshooting)
  * [Development](#development)
<!-- TOC -->


# Fan chart
This module provides an interactive SVG ancestor fan chart for the [webtrees](https://www.webtrees.net) genealogy application.
Click on any ancestor to re-center the chart on that person. Right-click to open a tooltip with detailed
dates, places, and images.

![210 Degree fan chart with family branch colors](assets/fan-chart-210-color.png)


## Installation
Requires **webtrees 2.2** and **PHP 8.3** or later.

### Manual installation
1. Download the [latest release](https://github.com/magicsunday/webtrees-fan-chart/releases/latest) (the `.zip` file).
2. Upload the `.zip` file to your web server.
3. Unzip the package into your `modules_v4` directory.
4. Rename the folder to `webtrees-fan-chart`.

You should now see a `modules_v4/webtrees-fan-chart` directory containing the module files.

### Using Composer
Run the following command from the root of your webtrees installation:

```shell
composer require magicsunday/webtrees-fan-chart --update-no-dev
```

The module will automatically install into the `modules_v4` directory.

To remove the module:
```shell
composer remove magicsunday/webtrees-fan-chart --update-no-dev
```

If you are using the development version of webtrees (`main` branch):
```shell
composer require magicsunday/webtrees-fan-chart:dev-main --update-no-dev
```

### Using Git
Clone the repository directly into your `modules_v4` directory:

```shell
git clone https://github.com/magicsunday/webtrees-fan-chart.git modules_v4/webtrees-fan-chart
```


## Update
To update to the latest version:

- **Manual installation**: Download the new release `.zip`, delete the old `modules_v4/webtrees-fan-chart` folder, and extract the new one.
- **Composer**: Run `composer update magicsunday/webtrees-fan-chart --update-no-dev`.
- **Git**: Run `git pull` inside the `modules_v4/webtrees-fan-chart` directory.


## Configuration
1. Go to the **Control Panel** (admin section) of your webtrees installation.
2. Scroll down to the **Modules** section and click on **Charts** (under Genealogy).
3. Enable the **Fan chart** module. Optionally disable the built-in fan chart to avoid confusion.
4. Click **Save**.

![Control panel - Module administration](assets/control-panel-modules.png)


## Usage
Open the **Charts** menu on any individual page and select **Fan chart**.

The form at the top lets you choose the starting person, fan size (180-360 degrees), and number of
generations (2-10).

Click **Show more options** to access additional settings:

| Option | Description |
|--------|-------------|
| **Show names** | Displays names and dates in the chart segments. When disabled, outer generations are hidden for an image-only chart. |
| **Show images** | Displays thumbnail images in the inner arcs and the center. Silhouette placeholders are used when no photo is available. |
| **Show places** | Displays birth and death places in inner generation arcs. Choose the level of detail (full name or lowest 1-3 hierarchy levels). |
| **Show parent marriage dates** | Displays marriage dates in a narrow arc between each pair of parent arcs. |
| **Show family colors** | Colors arcs by family branch. Paternal and maternal base colors are configurable via color pickers. |
| **Birth and death date precision** | Choose between full dates (DD.MM.YYYY) for inner generations or years only for all generations. |
| **Number of inner levels** | Controls how many generations use the wider inner-arc layout with text along the arc path. |
| **Font size** | Scales the text size (10-200%). |

**Interacting with the chart:**

| Action | Effect |
|--------|--------|
| Click on a person | Re-centers the chart on that person |
| Right-click on a person | Opens a detailed tooltip with dates, places, and image |
| Ctrl + scroll | Zoom in/out |
| Click and drag | Move the chart |
| Click center button | Reset view to center |
| PNG / SVG buttons | Export the chart as an image file |


## Troubleshooting

**The chart does not appear / shows an error**
- Make sure the module is enabled in the Control Panel under Modules > Charts.
- Check that your PHP version is 8.3 or later.
- Clear your browser cache and reload the page.

**Images are not displayed**
- Ensure "Show highlight images" is enabled in the tree preferences (Control Panel > Family trees > Preferences).
- Verify that media files are uploaded and linked to individuals.

**Places are not shown**
- Enable "Show places" in the chart options (under "Show more options").
- Make sure the individuals have PLAC fields in their GEDCOM records.


## Development
This section is for developers who want to contribute to the module.

### Building JavaScript
Using Docker (no local Node.js required):
```shell
make install
make build
```

Using local Node.js:
```shell
npm install
npm run prepare
```

### Running tests
```shell
# JavaScript tests
npm test

# Full PHP + JS quality check
composer update
composer ci:test
```
