/**
 * macOS Sandbox EPERM Fix
 *
 * The App Sandbox (VS Code / Antigravity) blocks the `mkdtemp` syscall
 * and `mkdir` in system temp paths (/var/folders). Vitest's worker pool
 * calls `mkdtemp` during initialization, causing EPERM on every test run.
 *
 * This polyfill replaces `mkdtemp` with `mkdir` + random suffix,
 * which the sandbox allows when TMPDIR points to the project directory.
 *
 * Usage: Set TMPDIR to a project-local dir and --require this file
 *   TMPDIR=./.tmp node --require ./src/test/fix-eperm.cjs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Only apply if TMPDIR is set to a project-local path (our safety guard)
const tmpDir = process.env.TMPDIR || '';
if (tmpDir && !tmpDir.startsWith('/var/folders') && !tmpDir.startsWith('/tmp')) {
    // Ensure the tmpdir exists
    try {
        fs.mkdirSync(tmpDir, { recursive: true });
    } catch {
        // Already exists or can't create — will error at mkdtemp time
    }

    // Polyfill mkdtempSync: use mkdir (allowed) instead of mkdtemp (blocked)
    const origMkdtempSync = fs.mkdtempSync;
    fs.mkdtempSync = function (prefix, options) {
        try {
            return origMkdtempSync.call(fs, prefix, options);
        } catch (err) {
            if (err.code === 'EPERM') {
                const suffix = crypto.randomBytes(6).toString('hex');
                const dir = prefix + suffix;
                fs.mkdirSync(dir, { recursive: true });
                return dir;
            }
            throw err;
        }
    };

    // Polyfill async mkdtemp
    const origMkdtemp = fs.mkdtemp;
    fs.mkdtemp = function (prefix, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = undefined;
        }
        origMkdtemp.call(fs, prefix, options, function (err, dir) {
            if (err && err.code === 'EPERM') {
                try {
                    const result = fs.mkdtempSync(prefix, options);
                    if (cb) cb(null, result);
                } catch (e) {
                    if (cb) cb(e);
                }
            } else {
                if (cb) cb(err, dir);
            }
        });
    };

    // Polyfill promises.mkdtemp
    if (fs.promises) {
        const origPromisesMkdtemp = fs.promises.mkdtemp;
        fs.promises.mkdtemp = async function (prefix, options) {
            try {
                return await origPromisesMkdtemp.call(fs.promises, prefix, options);
            } catch (err) {
                if (err.code === 'EPERM') {
                    return fs.mkdtempSync(prefix, options);
                }
                throw err;
            }
        };
    }
}
