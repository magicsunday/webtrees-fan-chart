[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](http://www.gnu.org/licenses/gpl-3.0)
[![Scrutinizer Code Quality](https://scrutinizer-ci.com/g/magicsunday/webtrees-fan-chart/badges/quality-score.png?b=master)](https://scrutinizer-ci.com/g/magicsunday/webtrees-fan-chart/?branch=master)
[![Code Climate](https://codeclimate.com/github/magicsunday/webtrees-fan-chart/badges/gpa.svg)](https://codeclimate.com/github/magicsunday/webtrees-fan-chart)
[![Test Coverage](https://codeclimate.com/github/magicsunday/webtrees-fan-chart/badges/coverage.svg)](https://codeclimate.com/github/magicsunday/webtrees-fan-chart/coverage)
[![Issue Count](https://codeclimate.com/github/magicsunday/webtrees-fan-chart/badges/issue_count.svg)](https://codeclimate.com/github/magicsunday/webtrees-fan-chart)

# Fan chart
This module provides an SVG ancestor fan chart for the [webtrees](https://www.webtrees.net) genealogy application.

![210 Degree chart](assets/fan-chart-210.png)
![210 Degree chart with color gradients and hidden empty segments](assets/fan-chart-210-gradient.png)


## Installation
Requires webtrees 2.0.

### Using Composer
To install using [composer](https://getcomposer.org/), just run the following command from the command line 
at the root directory of your webtrees installation.

``` 
composer require magicsunday/webtrees-fan-chart --update-no-dev
```

The module will automatically install into the ``modules_v4`` directory of your webtrees installation.

To remove the module run:
```
composer remove magicsunday/webtrees-fan-chart --update-no-dev
```

### Using Git
If you are using ``git``, you could also clone the current master branch directly into your ``modules_v4`` directory 
by calling:

```
git clone https://github.com/magicsunday/webtrees-fan-chart.git modules_v4/webtrees-fan-chart
```

### Manual installation
To manually install the module, perform the following steps:

1. Download the [latest release](https://github.com/magicsunday/webtrees-fan-chart/releases/latest).
2. Upload the downloaded file to your web server.
3. Unzip the package into your ``modules_v4`` directory.
4. Rename the folder to ``webtrees-fan-chart``

## Enable module
Go to the control panel (admin section) of your installation and scroll down to the ``Modules`` section. Click 
on ``Charts`` (in subsection Genealogy). Enable the ``Fan chart`` custom module (optionally disable the original
installed fan chart module) and save your settings.

![Control panel - Module administration](assets/control-panel-modules.png)


## Usage
At the charts' menu, you will find a new link called `Fan chart`.


## Development
To build/update the javascript, run the following commands:

```
npm install --unsafe-perm --save-dev
npm run prepare
```
