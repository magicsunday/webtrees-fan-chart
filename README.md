[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](http://www.gnu.org/licenses/gpl-3.0)
[![Scrutinizer Code Quality](https://scrutinizer-ci.com/g/magicsunday/ancestral-fan-chart/badges/quality-score.png?b=master)](https://scrutinizer-ci.com/g/magicsunday/ancestral-fan-chart/?branch=master)
[![Code Climate](https://codeclimate.com/github/magicsunday/ancestral-fan-chart/badges/gpa.svg)](https://codeclimate.com/github/magicsunday/ancestral-fan-chart)
[![Test Coverage](https://codeclimate.com/github/magicsunday/ancestral-fan-chart/badges/coverage.svg)](https://codeclimate.com/github/magicsunday/ancestral-fan-chart/coverage)
[![Issue Count](https://codeclimate.com/github/magicsunday/ancestral-fan-chart/badges/issue_count.svg)](https://codeclimate.com/github/magicsunday/ancestral-fan-chart)

# Ancestral fan chart
This modules provides an SVG ancestral fan chart for the [webtrees](https://www.webtrees.net) genealogy application.

![210 Degree chart](/assets/fan-chart-210.png)
![210 Degree chart with color gradients and hidden empty segments](/assets/fan-chart-210-gradient.png)


## Installation
1. Download the [latest release](https://github.com/magicsunday/ancestral-fan-chart/releases/latest).
2. Upload the downloaded file to your webserver.
3. Unzip the package into your `webtrees/modules_v3` directory.
4. Rename the folder to `ancestral-fan-chart`
5. Go to the contral panel (admin section) => Module administration => Enable the `Ancestral fan chart` module and save your settings.

![Control panel - Module administration](/assets/control-panel-modules.png)

If you are using ``git``, you could also clone the current master into your `webtrees/modules_v3` directory by calling

    git clone https://github.com/magicsunday/ancestral-fan-chart.git


## Usage
At the charts menu, you will find a new link called `Ancestral fan chart`.


## Development
To build custom d3 version, run the following commands inside /js/packages

    npm install
    npm run prepare
