"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = __importDefault(require("chalk"));
var path_1 = require("./path");
var spawnSafe_1 = require("./spawnSafe");
var filterFiles_1 = require("./filterFiles");
var fs_extra_1 = require("fs-extra");
var rimraf_1 = require("rimraf");
var fs_extra_2 = require("fs-extra");
var tmp_1 = require("tmp");
var patchFs_1 = require("./patchFs");
var PackageDetails_1 = require("./PackageDetails");
var resolveRelativeFileDependencies_1 = require("./resolveRelativeFileDependencies");
var getPackageResolution_1 = require("./getPackageResolution");
var parse_1 = require("./patch/parse");
var zlib_1 = require("zlib");
function printNoPackageFoundError(packageName, packageJsonPath) {
    console.error("No such package " + packageName + "\n\n  File not found: " + packageJsonPath);
}
function makePatch(_a) {
    var _b;
    var packagePathSpecifier = _a.packagePathSpecifier, appPath = _a.appPath, packageManager = _a.packageManager, includePaths = _a.includePaths, excludePaths = _a.excludePaths, patchDir = _a.patchDir;
    var packageDetails = PackageDetails_1.getPatchDetailsFromCliString(packagePathSpecifier);
    if (!packageDetails) {
        console.error("No such package", packagePathSpecifier);
        return;
    }
    var appPackageJson = require(path_1.join(appPath, "package.json"));
    var packagePath = path_1.join(appPath, packageDetails.path);
    var packageJsonPath = path_1.join(packagePath, "package.json");
    if (!fs_extra_1.existsSync(packageJsonPath)) {
        printNoPackageFoundError(packagePathSpecifier, packageJsonPath);
        process.exit(1);
    }
    var tmpRepo = tmp_1.dirSync({ unsafeCleanup: true });
    var tmpRepoPackagePath = path_1.join(tmpRepo.name, packageDetails.path);
    var tmpRepoNpmRoot = tmpRepoPackagePath.slice(0, -("/node_modules/" + packageDetails.name).length);
    var tmpRepoPackageJsonPath = path_1.join(tmpRepoNpmRoot, "package.json");
    try {
        var patchesDir = path_1.resolve(path_1.join(appPath, patchDir));
        console.info(chalk_1.default.grey("•"), "Creating temporary folder");
        // make a blank package.json
        fs_extra_1.mkdirpSync(tmpRepoNpmRoot);
        fs_extra_1.writeFileSync(tmpRepoPackageJsonPath, JSON.stringify({
            dependencies: (_b = {},
                _b[packageDetails.name] = getPackageResolution_1.getPackageResolution({
                    packageDetails: packageDetails,
                    packageManager: packageManager,
                    appPath: appPath,
                }),
                _b),
            resolutions: resolveRelativeFileDependencies_1.resolveRelativeFileDependencies(appPath, appPackageJson.resolutions || {}),
        }));
        var packageVersion = require(path_1.join(path_1.resolve(packageDetails.path), "package.json")).version;
        // copy .npmrc/.yarnrc in case packages are hosted in private registry
        [".npmrc", ".yarnrc"].forEach(function (rcFile) {
            var rcPath = path_1.join(appPath, rcFile);
            if (fs_extra_1.existsSync(rcPath)) {
                fs_extra_2.copySync(rcPath, path_1.join(tmpRepo.name, rcFile));
            }
        });
        if (packageManager === "yarn") {
            console.info(chalk_1.default.grey("•"), "Installing " + packageDetails.name + "@" + packageVersion + " with yarn");
            try {
                // try first without ignoring scripts in case they are required
                // this works in 99.99% of cases
                spawnSafe_1.spawnSafeSync("yarn", ["install", "--ignore-engines"], {
                    cwd: tmpRepoNpmRoot,
                    logStdErrOnError: false,
                });
            }
            catch (e) {
                // try again while ignoring scripts in case the script depends on
                // an implicit context which we havn't reproduced
                spawnSafe_1.spawnSafeSync("yarn", ["install", "--ignore-engines", "--ignore-scripts"], {
                    cwd: tmpRepoNpmRoot,
                });
            }
        }
        else {
            console.info(chalk_1.default.grey("•"), "Installing " + packageDetails.name + "@" + packageVersion + " with npm");
            try {
                // try first without ignoring scripts in case they are required
                // this works in 99.99% of cases
                spawnSafe_1.spawnSafeSync("npm", ["i"], {
                    cwd: tmpRepoNpmRoot,
                    logStdErrOnError: false,
                });
            }
            catch (e) {
                // try again while ignoring scripts in case the script depends on
                // an implicit context which we havn't reproduced
                spawnSafe_1.spawnSafeSync("npm", ["i", "--ignore-scripts"], {
                    cwd: tmpRepoNpmRoot,
                });
            }
        }
        var git = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return spawnSafe_1.spawnSafeSync("git", args, {
                cwd: tmpRepo.name,
                env: __assign(__assign({}, process.env), { HOME: tmpRepo.name }),
            });
        };
        // remove nested node_modules just to be safe
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, "node_modules"));
        // remove .git just to be safe
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, ".git"));
        // commit the package
        console.info(chalk_1.default.grey("•"), "Diffing your files with clean files");
        fs_extra_1.writeFileSync(path_1.join(tmpRepo.name, ".gitignore"), "!/node_modules\n\n");
        git("init");
        git("config", "--local", "user.name", "patch-package");
        git("config", "--local", "user.email", "patch@pack.age");
        // remove ignored files first
        filterFiles_1.removeIgnoredFiles(tmpRepoPackagePath, includePaths, excludePaths);
        git("add", "-f", packageDetails.path);
        git("commit", "--allow-empty", "-m", "init");
        // replace package with user's version
        rimraf_1.sync(tmpRepoPackagePath);
        fs_extra_2.copySync(packagePath, tmpRepoPackagePath);
        // remove nested node_modules just to be safe
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, "node_modules"));
        // remove .git just to be safe
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, "node_modules"));
        // also remove ignored files like before
        filterFiles_1.removeIgnoredFiles(tmpRepoPackagePath, includePaths, excludePaths);
        // stage all files
        git("add", "-f", packageDetails.path);
        // get diff of changes
        var diffResult = git("diff", "--cached", "--no-color", "--ignore-space-at-eol", "--no-ext-diff");
        if (diffResult.stdout.length === 0) {
            console.warn("\u2049\uFE0F  Not creating patch file for package '" + packagePathSpecifier + "'");
            console.warn("\u2049\uFE0F  There don't appear to be any changes.");
            process.exit(1);
            return;
        }
        try {
            parse_1.parsePatchFile(diffResult.stdout.toString());
        }
        catch (e) {
            if (e.message.includes("Unexpected file mode string: 120000")) {
                console.error("\n\u26D4\uFE0F " + chalk_1.default.red.bold("ERROR") + "\n\n  Your changes involve creating symlinks. patch-package does not yet support\n  symlinks.\n  \n  \uFE0FPlease use " + chalk_1.default.bold("--include") + " and/or " + chalk_1.default.bold("--exclude") + " to narrow the scope of your patch if\n  this was unintentional.\n");
            }
            else {
                var outPath = "./patch-package-error.json.gz";
                fs_extra_1.writeFileSync(outPath, zlib_1.gzipSync(JSON.stringify({
                    error: { message: e.message, stack: e.stack },
                    patch: diffResult.stdout.toString(),
                })));
                console.error("\n\u26D4\uFE0F " + chalk_1.default.red.bold("ERROR") + "\n        \n  patch-package was unable to read the patch-file made by git. This should not\n  happen.\n  \n  A diagnostic file was written to\n  \n    " + outPath + "\n  \n  Please attach it to a github issue\n  \n    https://github.com/ds300/patch-package/issues/new?title=New+patch+parse+failed&body=Please+attach+the+diagnostic+file+by+dragging+it+into+here+\uD83D\uDE4F\n  \n  Note that this diagnostic file will contain code from the package you were\n  attempting to patch.\n\n");
            }
            process.exit(1);
            return;
        }
        var packageNames = packageDetails.packageNames
            .map(function (name) { return name.replace(/\//g, "+"); })
            .join("++");
        // maybe delete existing
        patchFs_1.getPatchFiles(patchDir).forEach(function (filename) {
            var deets = PackageDetails_1.getPackageDetailsFromPatchFilename(filename);
            if (deets && deets.path === packageDetails.path) {
                fs_extra_1.unlinkSync(path_1.join(patchDir, filename));
            }
        });
        var patchFileName = packageNames + "+" + packageVersion + ".patch";
        var patchPath = path_1.join(patchesDir, patchFileName);
        if (!fs_extra_1.existsSync(path_1.dirname(patchPath))) {
            // scoped package
            fs_extra_1.mkdirSync(path_1.dirname(patchPath));
        }
        fs_extra_1.writeFileSync(patchPath, diffResult.stdout);
        console.log(chalk_1.default.green("✔") + " Created file " + path_1.join(patchDir, patchFileName));
    }
    catch (e) {
        console.error(e);
        throw e;
    }
    finally {
        tmpRepo.removeCallback();
    }
}
exports.makePatch = makePatch;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFrZVBhdGNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL21ha2VQYXRjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsZ0RBQXlCO0FBQ3pCLCtCQUErQztBQUMvQyx5Q0FBMkM7QUFFM0MsNkNBQWtEO0FBQ2xELHFDQU1pQjtBQUNqQixpQ0FBdUM7QUFDdkMscUNBQW1DO0FBQ25DLDJCQUE2QjtBQUM3QixxQ0FBeUM7QUFDekMsbURBR3lCO0FBQ3pCLHFGQUFtRjtBQUNuRiwrREFBNkQ7QUFDN0QsdUNBQThDO0FBQzlDLDZCQUErQjtBQUUvQixTQUFTLHdCQUF3QixDQUMvQixXQUFtQixFQUNuQixlQUF1QjtJQUV2QixPQUFPLENBQUMsS0FBSyxDQUNYLHFCQUFtQixXQUFXLDhCQUVkLGVBQWlCLENBQ2xDLENBQUE7QUFDSCxDQUFDO0FBRUQsU0FBZ0IsU0FBUyxDQUFDLEVBY3pCOztRQWJDLDhDQUFvQixFQUNwQixvQkFBTyxFQUNQLGtDQUFjLEVBQ2QsOEJBQVksRUFDWiw4QkFBWSxFQUNaLHNCQUFRO0lBU1IsSUFBTSxjQUFjLEdBQUcsNkNBQTRCLENBQUMsb0JBQW9CLENBQUMsQ0FBQTtJQUV6RSxJQUFJLENBQUMsY0FBYyxFQUFFO1FBQ25CLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsb0JBQW9CLENBQUMsQ0FBQTtRQUN0RCxPQUFNO0tBQ1A7SUFDRCxJQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsV0FBSSxDQUFDLE9BQU8sRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFBO0lBQzdELElBQU0sV0FBVyxHQUFHLFdBQUksQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFBO0lBQ3RELElBQU0sZUFBZSxHQUFHLFdBQUksQ0FBQyxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUE7SUFFekQsSUFBSSxDQUFDLHFCQUFVLENBQUMsZUFBZSxDQUFDLEVBQUU7UUFDaEMs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b3VyY2VzQ29udGVudCI6WyJpbXBvcnQgY2hhbGsgZnJvbSBcImNoYWxrXCJcbmltcG9ydCB7IGpvaW4sIGRpcm5hbWUsIHJlc29sdmUgfSBmcm9tIFwiLi9wYXRoXCJcbmltcG9ydCB7IHNwYXduU2FmZVN5bmMgfSBmcm9tIFwiLi9zcGF3blNhZmVcIlxuaW1wb3J0IHsgUGFja2FnZU1hbmFnZXIgfSBmcm9tIFwiLi9kZXRlY3RQYWNrYWdlTWFuYWdlclwiXG5pbXBvcnQgeyByZW1vdmVJZ25vcmVkRmlsZXMgfSBmcm9tIFwiLi9maWx0ZXJGaWxlc1wiXG5pbXBvcnQge1xuICB3cml0ZUZpbGVTeW5jLFxuICBleGlzdHNTeW5jLFxuICBta2RpclN5bmMsXG4gIHVubGlua1N5bmMsXG4gIG1rZGlycFN5bmMsXG59IGZyb20gXCJmcy1leHRyYVwiXG5pbXBvcnQgeyBzeW5jIGFzIHJpbXJhZiB9IGZyb20gXCJyaW1yYWZcIlxuaW1wb3J0IHsgY29weVN5bmMgfSBmcm9tIFwiZnMtZXh0cmFcIlxuaW1wb3J0IHsgZGlyU3luYyB9IGZyb20gXCJ0bXBcIlxuaW1wb3J0IHsgZ2V0UGF0Y2hGaWxlcyB9IGZyb20gXCIuL3BhdGNoRnNcIlxuaW1wb3J0IHtcbiAgZ2V0UGF0Y2hEZXRhaWxzRnJvbUNsaVN0cmluZyxcbiAgZ2V0UGFja2FnZURldGFpbHNGcm9tUGF0Y2hGaWxlbmFtZSxcbn0gZnJvbSBcIi4vUGFja2FnZURldGFpbHNcIlxuaW1wb3J0IHsgcmVzb2x2ZVJlbGF0aXZlRmlsZURlcGVuZGVuY2llcyB9IGZyb20gXCIuL3Jlc29sdmVSZWxhdGl2ZUZpbGVEZXBlbmRlbmNpZXNcIlxuaW1wb3J0IHsgZ2V0UGFja2FnZVJlc29sdXRpb24gfSBmcm9tIFwiLi9nZXRQYWNrYWdlUmVzb2x1dGlvblwiXG5pbXBvcnQgeyBwYXJzZVBhdGNoRmlsZSB9IGZyb20gXCIuL3BhdGNoL3BhcnNlXCJcbmltcG9ydCB7IGd6aXBTeW5jIH0gZnJvbSBcInpsaWJcIlxuXG5mdW5jdGlvbiBwcmludE5vUGFja2FnZUZvdW5kRXJyb3IoXG4gIHBhY2thZ2VOYW1lOiBzdHJpbmcsXG4gIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nLFxuKSB7XG4gIGNvbnNvbGUuZXJyb3IoXG4gICAgYE5vIHN1Y2ggcGFja2FnZSAke3BhY2thZ2VOYW1lfVxuXG4gIEZpbGUgbm90IGZvdW5kOiAke3BhY2thZ2VKc29uUGF0aH1gLFxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYWtlUGF0Y2goe1xuICBwYWNrYWdlUGF0aFNwZWNpZmllcixcbiAgYXBwUGF0aCxcbiAgcGFja2FnZU1hbmFnZXIsXG4gIGluY2x1ZGVQYXRocyxcbiAgZXhjbHVkZVBhdGhzLFxuICBwYXRjaERpcixcbn06IHtcbiAgcGFja2FnZVBhdGhTcGVjaWZpZXI6IHN0cmluZ1xuICBhcHBQYXRoOiBzdHJpbmdcbiAgcGFja2FnZU1hbmFnZXI6IFBhY2thZ2VNYW5hZ2VyXG4gIGluY2x1ZGVQYXRoczogUmVnRXhwXG4gIGV4Y2x1ZGVQYXRoczogUmVnRXhwXG4gIHBhdGNoRGlyOiBzdHJpbmdcbn0pIHtcbiAgY29uc3QgcGFja2FnZURldGFpbHMgPSBnZXRQYXRjaERldGFpbHNGcm9tQ2xpU3RyaW5nKHBhY2thZ2VQYXRoU3BlY2lmaWVyKVxuXG4gIGlmICghcGFja2FnZURldGFpbHMpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiTm8gc3VjaCBwYWNrYWdlXCIsIHBhY2thZ2VQYXRoU3BlY2lmaWVyKVxuICAgIHJldHVyblxuICB9XG4gIGNvbnN0IGFwcFBhY2thZ2VKc29uID0gcmVxdWlyZShqb2luKGFwcFBhdGgsIFwicGFja2FnZS5qc29uXCIpKVxuICBjb25zdCBwYWNrYWdlUGF0aCA9IGpvaW4oYXBwUGF0aCwgcGFja2FnZURldGFpbHMucGF0aClcbiAgY29uc3QgcGFja2FnZUpzb25QYXRoID0gam9pbihwYWNrYWdlUGF0aCwgXCJwYWNrYWdlLmpzb25cIilcblxuICBpZiAoIWV4aXN0c1N5bmMocGFja2FnZUpzb25QYXRoKSkge1xuICAgIHByaW50Tm9QYWNrYWdlRm91bmRFcnJvcihwYWNrYWdlUGF0aFNwZWNpZmllciwgcGFja2FnZUpzb25QYXRoKVxuICAgIHByb2Nlc3MuZXhpdCgxKVxuICB9XG5cbiAgY29uc3QgdG1wUmVwbyA9IGRpclN5bmMoeyB1bnNhZmVDbGVhbnVwOiB0cnVlIH0pXG4gIGNvbnN0IHRtcFJlcG9QYWNrYWdlUGF0aCA9IGpvaW4odG1wUmVwby5uYW1lLCBwYWNrYWdlRGV0YWlscy5wYXRoKVxuICBjb25zdCB0bXBSZXBvTnBtUm9vdCA9IHRtcFJlcG9QYWNrYWdlUGF0aC5zbGljZShcbiAgICAwLFxuICAgIC1gL25vZGVfbW9kdWxlcy8ke3BhY2thZ2VEZXRhaWxzLm5hbWV9YC5sZW5ndGgsXG4gIClcblxuICBjb25zdCB0bXBSZXBvUGFja2FnZUpzb25QYXRoID0gam9pbih0bXBSZXBvTnBtUm9vdCwgXCJwYWNrYWdlLmpzb25cIilcblxuICB0cnkge1xuICAgIGNvbnN0IHBhdGNoZXNEaXIgPSByZXNvbHZlKGpvaW4oYXBwUGF0aCwgcGF0Y2hEaXIpKVxuXG4gICAgY29uc29sZS5pbmZvKGNoYWxrLmdyZXkoXCLigKJcIiksIFwiQ3JlYXRpbmcgdGVtcG9yYXJ5IGZvbGRlclwiKVxuXG4gICAgLy8gbWFrZSBhIGJsYW5rIHBhY2thZ2UuanNvblxuICAgIG1rZGlycFN5bmModG1wUmVwb05wbVJvb3QpXG4gICAgd3JpdGVGaWxlU3luYyhcbiAgICAgIHRtcFJlcG9QYWNrYWdlSnNvblBhdGgsXG4gICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGRlcGVuZGVuY2llczoge1xuICAgICAgICAgIFtwYWNrYWdlRGV0YWlscy5uYW1lXTogZ2V0UGFja2FnZVJlc29sdXRpb24oe1xuICAgICAgICAgICAgcGFja2FnZURldGFpbHMsXG4gICAgICAgICAgICBwYWNrYWdlTWFuYWdlcixcbiAgICAgICAgICAgIGFwcFBhdGgsXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICAgIHJlc29sdXRpb25zOiByZXNvbHZlUmVsYXRpdmVGaWxlRGVwZW5kZW5jaWVzKFxuICAgICAgICAgIGFwcFBhdGgsXG4gICAgICAgICAgYXBwUGFja2FnZUpzb24ucmVzb2x1dGlvbnMgfHwge30sXG4gICAgICAgICksXG4gICAgICB9KSxcbiAgICApXG5cbiAgICBjb25zdCBwYWNrYWdlVmVyc2lvbiA9IHJlcXVpcmUoam9pbihcbiAgICAgIHJlc29sdmUocGFja2FnZURldGFpbHMucGF0aCksXG4gICAgICBcInBhY2thZ2UuanNvblwiLFxuICAgICkpLnZlcnNpb24gYXMgc3RyaW5nXG5cbiAgICAvLyBjb3B5IC5ucG1yYy8ueWFybnJjIGluIGNhc2UgcGFja2FnZXMgYXJlIGhvc3RlZCBpbiBwcml2YXRlIHJlZ2lzdHJ5XG4gICAgW1wiLm5wbXJjXCIsIFwiLnlhcm5yY1wiXS5mb3JFYWNoKHJjRmlsZSA9PiB7XG4gICAgICBjb25zdCByY1BhdGggPSBqb2luKGFwcFBhdGgsIHJjRmlsZSlcbiAgICAgIGlmIChleGlzdHNTeW5jKHJjUGF0aCkpIHtcbiAgICAgICAgY29weVN5bmMocmNQYXRoLCBqb2luKHRtcFJlcG8ubmFtZSwgcmNGaWxlKSlcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgaWYgKHBhY2thZ2VNYW5hZ2VyID09PSBcInlhcm5cIikge1xuICAgICAgY29uc29sZS5pbmZvKFxuICAgICAgICBjaGFsay5ncmV5KFwi4oCiXCIpLFxuICAgICAgICBgSW5zdGFsbGluZyAke3BhY2thZ2VEZXRhaWxzLm5hbWV9QCR7cGFja2FnZVZlcnNpb259IHdpdGggeWFybmAsXG4gICAgICApXG4gICAgICB0cnkge1xuICAgICAgICAvLyB0cnkgZmlyc3Qgd2l0aG91dCBpZ25vcmluZyBzY3JpcHRzIGluIGNhc2UgdGhleSBhcmUgcmVxdWlyZWRcbiAgICAgICAgLy8gdGhpcyB3b3JrcyBpbiA5OS45OSUgb2YgY2FzZXNcbiAgICAgICAgc3Bhd25TYWZlU3luYyhgeWFybmAsIFtcImluc3RhbGxcIiwgXCItLWlnbm9yZS1lbmdpbmVzXCJdLCB7XG4gICAgICAgICAgY3dkOiB0bXBSZXBvTnBtUm9vdCxcbiAgICAgICAgICBsb2dTdGRFcnJPbkVycm9yOiBmYWxzZSxcbiAgICAgICAgfSlcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gdHJ5IGFnYWluIHdoaWxlIGlnbm9yaW5nIHNjcmlwdHMgaW4gY2FzZSB0aGUgc2NyaXB0IGRlcGVuZHMgb25cbiAgICAgICAgLy8gYW4gaW1wbGljaXQgY29udGV4dCB3aGljaCB3ZSBoYXZuJ3QgcmVwcm9kdWNlZFxuICAgICAgICBzcGF3blNhZmVTeW5jKFxuICAgICAgICAgIGB5YXJuYCxcbiAgICAgICAgICBbXCJpbnN0YWxsXCIsIFwiLS1pZ25vcmUtZW5naW5lc1wiLCBcIi0taWdub3JlLXNjcmlwdHNcIl0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgY3dkOiB0bXBSZXBvTnBtUm9vdCxcbiAgICAgICAgICB9LFxuICAgICAgICApXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuaW5mbyhcbiAgICAgICAgY2hhbGsuZ3JleShcIuKAolwiKSxcbiAgICAgICAgYEluc3RhbGxpbmcgJHtwYWNrYWdlRGV0YWlscy5uYW1lfUAke3BhY2thZ2VWZXJzaW9ufSB3aXRoIG5wbWAsXG4gICAgICApXG4gICAgICB0cnkge1xuICAgICAgICAvLyB0cnkgZmlyc3Qgd2l0aG91dCBpZ25vcmluZyBzY3JpcHRzIGluIGNhc2UgdGhleSBhcmUgcmVxdWlyZWRcbiAgICAgICAgLy8gdGhpcyB3b3JrcyBpbiA5OS45OSUgb2YgY2FzZXNcbiAgICAgICAgc3Bhd25TYWZlU3luYyhgbnBtYCwgW1wiaVwiXSwge1xuICAgICAgICAgIGN3ZDogdG1wUmVwb05wbVJvb3QsXG4gICAgICAgICAgbG9nU3RkRXJyT25FcnJvcjogZmFsc2UsXG4gICAgICAgIH0pXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIHRyeSBhZ2FpbiB3aGlsZSBpZ25vcmluZyBzY3JpcHRzIGluIGNhc2UgdGhlIHNjcmlwdCBkZXBlbmRzIG9uXG4gICAgICAgIC8vIGFuIGltcGxpY2l0IGNvbnRleHQgd2hpY2ggd2UgaGF2bid0IHJlcHJvZHVjZWRcbiAgICAgICAgc3Bhd25TYWZlU3luYyhgbnBtYCwgW1wiaVwiLCBcIi0taWdub3JlLXNjcmlwdHNcIl0sIHtcbiAgICAgICAgICBjd2Q6IHRtcFJlcG9OcG1Sb290LFxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGdpdCA9ICguLi5hcmdzOiBzdHJpbmdbXSkgPT5cbiAgICAgIHNwYXduU2FmZVN5bmMoXCJnaXRcIiwgYXJncywge1xuICAgICAgICBjd2Q6IHRtcFJlcG8ubmFtZSxcbiAgICAgICAgZW52OiB7IC4uLnByb2Nlc3MuZW52LCBIT01FOiB0bXBSZXBvLm5hbWUgfSxcbiAgICAgIH0pXG5cbiAgICAvLyByZW1vdmUgbmVzdGVkIG5vZGVfbW9kdWxlcyBqdXN0IHRvIGJlIHNhZmVcbiAgICByaW1yYWYoam9pbih0bXBSZXBvUGFja2FnZVBhdGgsIFwibm9kZV9tb2R1bGVzXCIpKVxuICAgIC8vIHJlbW92ZSAuZ2l0IGp1c3QgdG8gYmUgc2FmZVxuICAgIHJpbXJhZihqb2luKHRtcFJlcG9QYWNrYWdlUGF0aCwgXCIuZ2l0XCIpKVxuXG4gICAgLy8gY29tbWl0IHRoZSBwYWNrYWdlXG4gICAgY29uc29sZS5pbmZvKGNoYWxrLmdyZXkoXCLigKJcIiksIFwiRGlmZmluZyB5b3VyIGZpbGVzIHdpdGggY2xlYW4gZmlsZXNcIilcbiAgICB3cml0ZUZpbGVTeW5jKGpvaW4odG1wUmVwby5uYW1lLCBcIi5naXRpZ25vcmVcIiksIFwiIS9ub2RlX21vZHVsZXNcXG5cXG5cIilcbiAgICBnaXQoXCJpbml0XCIpXG4gICAgZ2l0KFwiY29uZmlnXCIsIFwiLS1sb2NhbFwiLCBcInVzZXIubmFtZVwiLCBcInBhdGNoLXBhY2thZ2VcIilcbiAgICBnaXQoXCJjb25maWdcIiwgXCItLWxvY2FsXCIsIFwidXNlci5lbWFpbFwiLCBcInBhdGNoQHBhY2suYWdlXCIpXG5cbiAgICAvLyByZW1vdmUgaWdub3JlZCBmaWxlcyBmaXJzdFxuICAgIHJlbW92ZUlnbm9yZWRGaWxlcyh0bXBSZXBvUGFja2FnZVBhdGgsIGluY2x1ZGVQYXRocywgZXhjbHVkZVBhdGhzKVxuXG4gICAgZ2l0KFwiYWRkXCIsIFwiLWZcIiwgcGFja2FnZURldGFpbHMucGF0aClcbiAgICBnaXQoXCJjb21taXRcIiwgXCItLWFsbG93LWVtcHR5XCIsIFwiLW1cIiwgXCJpbml0XCIpXG5cbiAgICAvLyByZXBsYWNlIHBhY2thZ2Ugd2l0aCB1c2VyJ3MgdmVyc2lvblxuICAgIHJpbXJhZih0bXBSZXBvUGFja2FnZVBhdGgpXG5cbiAgICBjb3B5U3luYyhwYWNrYWdlUGF0aCwgdG1wUmVwb1BhY2thZ2VQYXRoKVxuXG4gICAgLy8gcmVtb3ZlIG5lc3RlZCBub2RlX21vZHVsZXMganVzdCB0byBiZSBzYWZlXG4gICAgcmltcmFmKGpvaW4odG1wUmVwb1BhY2thZ2VQYXRoLCBcIm5vZGVfbW9kdWxlc1wiKSlcbiAgICAvLyByZW1vdmUgLmdpdCBqdXN0IHRvIGJlIHNhZmVcbiAgICByaW1yYWYoam9pbih0bXBSZXBvUGFja2FnZVBhdGgsIFwibm9kZV9tb2R1bGVzXCIpKVxuXG4gICAgLy8gYWxzbyByZW1vdmUgaWdub3JlZCBmaWxlcyBsaWtlIGJlZm9yZVxuICAgIHJlbW92ZUlnbm9yZWRGaWxlcyh0bXBSZXBvUGFja2FnZVBhdGgsIGluY2x1ZGVQYXRocywgZXhjbHVkZVBhdGhzKVxuXG4gICAgLy8gc3RhZ2UgYWxsIGZpbGVzXG4gICAgZ2l0KFwiYWRkXCIsIFwiLWZcIiwgcGFja2FnZURldGFpbHMucGF0aClcblxuICAgIC8vIGdldCBkaWZmIG9mIGNoYW5nZXNcbiAgICBjb25zdCBkaWZmUmVzdWx0ID0gZ2l0KFxuICAgICAgXCJkaWZmXCIsXG4gICAgICBcIi0tY2FjaGVkXCIsXG4gICAgICBcIi0tbm8tY29sb3JcIixcbiAgICAgIFwiLS1pZ25vcmUtc3BhY2UtYXQtZW9sXCIsXG4gICAgICBcIi0tbm8tZXh0LWRpZmZcIixcbiAgICApXG5cbiAgICBpZiAoZGlmZlJlc3VsdC5zdGRvdXQubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIGDigYnvuI8gIE5vdCBjcmVhdGluZyBwYXRjaCBmaWxlIGZvciBwYWNrYWdlICcke3BhY2thZ2VQYXRoU3BlY2lmaWVyfSdgLFxuICAgICAgKVxuICAgICAgY29uc29sZS53YXJuKGDigYnvuI8gIFRoZXJlIGRvbid0IGFwcGVhciB0byBiZSBhbnkgY2hhbmdlcy5gKVxuICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgcGFyc2VQYXRjaEZpbGUoZGlmZlJlc3VsdC5zdGRvdXQudG9TdHJpbmcoKSlcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoXG4gICAgICAgIChlIGFzIEVycm9yKS5tZXNzYWdlLmluY2x1ZGVzKFwiVW5leHBlY3RlZCBmaWxlIG1vZGUgc3RyaW5nOiAxMjAwMDBcIilcbiAgICAgICkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBcbuKblO+4jyAke2NoYWxrLnJlZC5ib2xkKFwiRVJST1JcIil9XG5cbiAgWW91ciBjaGFuZ2VzIGludm9sdmUgY3JlYXRpbmcgc3ltbGlua3MuIHBhdGNoLXBhY2thZ2UgZG9lcyBub3QgeWV0IHN1cHBvcnRcbiAgc3ltbGlua3MuXG4gIFxuICDvuI9QbGVhc2UgdXNlICR7Y2hhbGsuYm9sZChcIi0taW5jbHVkZVwiKX0gYW5kL29yICR7Y2hhbGsuYm9sZChcbiAgICAgICAgICBcIi0tZXhjbHVkZVwiLFxuICAgICAgICApfSB0byBuYXJyb3cgdGhlIHNjb3BlIG9mIHlvdXIgcGF0Y2ggaWZcbiAgdGhpcyB3YXMgdW5pbnRlbnRpb25hbC5cbmApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBvdXRQYXRoID0gXCIuL3BhdGNoLXBhY2thZ2UtZXJyb3IuanNvbi5nelwiXG4gICAgICAgIHdyaXRlRmlsZVN5bmMoXG4gICAgICAgICAgb3V0UGF0aCxcbiAgICAgICAgICBnemlwU3luYyhcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgZXJyb3I6IHsgbWVzc2FnZTogZS5tZXNzYWdlLCBzdGFjazogZS5zdGFjayB9LFxuICAgICAgICAgICAgICBwYXRjaDogZGlmZlJlc3VsdC5zdGRvdXQudG9TdHJpbmcoKSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICksXG4gICAgICAgIClcbiAgICAgICAgY29uc29sZS5lcnJvcihgXG7im5TvuI8gJHtjaGFsay5yZWQuYm9sZChcIkVSUk9SXCIpfVxuICAgICAgICBcbiAgcGF0Y2gtcGFja2FnZSB3YXMgdW5hYmxlIHRvIHJlYWQgdGhlIHBhdGNoLWZpbGUgbWFkZSBieSBnaXQuIFRoaXMgc2hvdWxkIG5vdFxuICBoYXBwZW4uXG4gIFxuICBBIGRpYWdub3N0aWMgZmlsZSB3YXMgd3JpdHRlbiB0b1xuICBcbiAgICAke291dFBhdGh9XG4gIFxuICBQbGVhc2UgYXR0YWNoIGl0IHRvIGEgZ2l0aHViIGlzc3VlXG4gIFxuICAgIGh0dHBzOi8vZ2l0aHViLmNvbS9kczMwMC9wYXRjaC1wYWNrYWdlL2lzc3Vlcy9uZXc/dGl0bGU9TmV3K3BhdGNoK3BhcnNlK2ZhaWxlZCZib2R5PVBsZWFzZSthdHRhY2grdGhlK2RpYWdub3N0aWMrZmlsZStieStkcmFnZ2luZytpdCtpbnRvK2hlcmUr8J+Zj1xuICBcbiAgTm90ZSB0aGF0IHRoaXMgZGlhZ25vc3RpYyBmaWxlIHdpbGwgY29udGFpbiBjb2RlIGZyb20gdGhlIHBhY2thZ2UgeW91IHdlcmVcbiAgYXR0ZW1wdGluZyB0byBwYXRjaC5cblxuYClcbiAgICAgIH1cbiAgICAgIHByb2Nlc3MuZXhpdCgxKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgY29uc3QgcGFja2FnZU5hbWVzID0gcGFja2FnZURldGFpbHMucGFja2FnZU5hbWVzXG4gICAgICAubWFwKG5hbWUgPT4gbmFtZS5yZXBsYWNlKC9cXC8vZywgXCIrXCIpKVxuICAgICAgLmpvaW4oXCIrK1wiKVxuXG4gICAgLy8gbWF5YmUgZGVsZXRlIGV4aXN0aW5nXG4gICAgZ2V0UGF0Y2hGaWxlcyhwYXRjaERpcikuZm9yRWFjaChmaWxlbmFtZSA9PiB7XG4gICAgICBjb25zdCBkZWV0cyA9IGdldFBhY2thZ2VEZXRhaWxzRnJvbVBhdGNoRmlsZW5hbWUoZmlsZW5hbWUpXG4gICAgICBpZiAoZGVldHMgJiYgZGVldHMucGF0aCA9PT0gcGFja2FnZURldGFpbHMucGF0aCkge1xuICAgICAgICB1bmxpbmtTeW5jKGpvaW4ocGF0Y2hEaXIsIGZpbGVuYW1lKSlcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgY29uc3QgcGF0Y2hGaWxlTmFtZSA9IGAke3BhY2thZ2VOYW1lc30rJHtwYWNrYWdlVmVyc2lvbn0ucGF0Y2hgXG5cbiAgICBjb25zdCBwYXRjaFBhdGggPSBqb2luKHBhdGNoZXNEaXIsIHBhdGNoRmlsZU5hbWUpXG4gICAgaWYgKCFleGlzdHNTeW5jKGRpcm5hbWUocGF0Y2hQYXRoKSkpIHtcbiAgICAgIC8vIHNjb3BlZCBwYWNrYWdlXG4gICAgICBta2RpclN5bmMoZGlybmFtZShwYXRjaFBhdGgpKVxuICAgIH1cbiAgICB3cml0ZUZpbGVTeW5jKHBhdGNoUGF0aCwgZGlmZlJlc3VsdC5zdGRvdXQpXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgJHtjaGFsay5ncmVlbihcIuKclFwiKX0gQ3JlYXRlZCBmaWxlICR7am9pbihwYXRjaERpciwgcGF0Y2hGaWxlTmFtZSl9YCxcbiAgICApXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLmVycm9yKGUpXG4gICAgdGhyb3cgZVxuICB9IGZpbmFsbHkge1xuICAgIHRtcFJlcG8ucmVtb3ZlQ2FsbGJhY2soKVxuICB9XG59XG4iXX0=