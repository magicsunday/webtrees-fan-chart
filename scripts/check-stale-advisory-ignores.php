<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Scripts;

/*
 * Fails when an entry of config.policy.advisories.ignore-id of composer.json is missing from the ignored advisories
 * of the audit report, so that an entry that has become removable is noticed.
 *
 * Usage: php check-stale-advisory-ignores.php <composer.json> <audit.json>
 *
 * The audit file is the output of `composer audit --format=json`. The script reads the "ignored-advisories" of
 * that file, grouped by package, and compares the keys of ignore-id with their "advisoryId" values. An entry has
 * to be an advisory id (PKSA-...), because an entry keyed by a CVE or a remote id never matches and is reported
 * as stale.
 *
 * Exit status: 0 when every ignored id still applies, 1 when at least one is stale, 2 when an input cannot be read.
 */

use JsonException;

use function array_diff;
use function array_values;
use function count;
use function file_get_contents;
use function fwrite;
use function implode;
use function is_array;
use function is_file;
use function is_string;
use function json_decode;
use function sort;

use const JSON_THROW_ON_ERROR;
use const STDERR;

/**
 * Reads a JSON file into an array, ends the script with status 2 when that is not possible.
 *
 * @return array<array-key, mixed>
 */
function readJsonFile(string $path): array
{
    $contents = is_file($path) ? file_get_contents($path) : false;

    if ($contents === false) {
        fwrite(STDERR, "Cannot read $path\n");

        exit(2);
    }

    try {
        $decoded = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        fwrite(STDERR, "$path is not valid JSON\n");

        exit(2);
    }

    if (!is_array($decoded)) {
        fwrite(STDERR, "$path is not a JSON object\n");

        exit(2);
    }

    return $decoded;
}

/**
 * Returns the value below the given keys, or null when a key is missing or the path leaves the arrays.
 *
 * @param array<array-key, mixed> $data
 * @param list<string>            $keys
 *
 * @return array<array-key, mixed>|null
 */
function valueAt(array $data, array $keys): ?array
{
    $current = $data;

    foreach ($keys as $key) {
        if (!isset($current[$key]) || !is_array($current[$key])) {
            return null;
        }

        $current = $current[$key];
    }

    return $current;
}

/** @var list<string> $arguments */
$arguments = $_SERVER['argv'] ?? [];

if (count($arguments) !== 3) {
    fwrite(STDERR, "Usage: php check-stale-advisory-ignores.php <composer.json> <audit.json>\n");

    exit(2);
}

$manifest = readJsonFile($arguments[1]);
$audit    = readJsonFile($arguments[2]);

// The ignore-id setting holds either a map of id to reason or a plain list of ids.
$ignoredIds = [];

foreach (valueAt($manifest, ['config', 'policy', 'advisories', 'ignore-id']) ?? [] as $key => $value) {
    if (is_string($key)) {
        $ignoredIds[] = $key;
    } elseif (is_string($value)) {
        $ignoredIds[] = $value;
    }
}

$appliedIds = [];

foreach (valueAt($audit, ['ignored-advisories']) ?? [] as $advisories) {
    if (!is_array($advisories)) {
        continue;
    }

    foreach ($advisories as $advisory) {
        if (is_array($advisory) && is_string($advisory['advisoryId'] ?? null)) {
            $appliedIds[] = $advisory['advisoryId'];
        }
    }
}

$stale = array_values(array_diff($ignoredIds, $appliedIds));

if ($stale === []) {
    exit(0);
}

sort($stale);

fwrite(
    STDERR,
    "Stale advisory ignores, no installed package matches them any more:\n  "
    . implode("\n  ", $stale)
    . "\nRemove these entries from config.policy.advisories.ignore-id in composer.json.\n"
);

exit(1);
