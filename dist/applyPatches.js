"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = __importDefault(require("chalk"));
var patchFs_1 = require("./patchFs");
var apply_1 = require("./patch/apply");
var fs_extra_1 = require("fs-extra");
var path_1 = require("./path");
var path_2 = require("path");
var PackageDetails_1 = require("./PackageDetails");
var reverse_1 = require("./patch/reverse");
var is_ci_1 = __importDefault(require("is-ci"));
var semver_1 = __importDefault(require("semver"));
var read_1 = require("./patch/read");
var packageIsDevDependency_1 = require("./packageIsDevDependency");
// don't want to exit(1) on postinsall locally.
// see https://github.com/ds300/patch-package/issues/86
var shouldExitPostinstallWithError = is_ci_1.default || process.env.NODE_ENV === "test";
var exit = function () { return process.exit(shouldExitPostinstallWithError ? 1 : 0); };
function findPatchFiles(patchesDirectory) {
    if (!fs_extra_1.existsSync(patchesDirectory)) {
        return [];
    }
    return patchFs_1.getPatchFiles(patchesDirectory);
}
function getInstalledPackageVersion(_a) {
    var appPath = _a.appPath, path = _a.path, pathSpecifier = _a.pathSpecifier, isDevOnly = _a.isDevOnly, patchFilename = _a.patchFilename;
    var packageDir = path_1.join(appPath, path);
    if (!fs_extra_1.existsSync(packageDir)) {
        if (process.env.NODE_ENV === "production" && isDevOnly) {
            return null;
        }
        console.error(chalk_1.default.red("Error:") + " Patch file found for package " + path_2.posix.basename(pathSpecifier) + (" which is not present at " + path_1.relative(".", packageDir)));
        if (!isDevOnly && process.env.NODE_ENV === "production") {
            console.error("\n  If this package is a dev dependency, rename the patch file to\n  \n    " + chalk_1.default.bold(patchFilename.replace(".patch", ".dev.patch")) + "\n");
        }
        exit();
    }
    var version = require(path_1.join(packageDir, "package.json")).version;
    // normalize version for `npm ci`
    var result = semver_1.default.valid(version);
    if (result === null) {
        console.error(chalk_1.default.red("Error:") + " Version string '" + version + "' cannot be parsed from " + path_1.join(packageDir, "package.json"));
        exit();
    }
    return result;
}
function applyPatchesForApp(_a) {
    var appPath = _a.appPath, reverse = _a.reverse, patchDir = _a.patchDir;
    var patchesDirectory = path_1.join(appPath, patchDir);
    var files = findPatchFiles(patchesDirectory);
    if (files.length === 0) {
        console.error(chalk_1.default.red("No patch files found"));
        return;
    }
    files.forEach(function (filename) {
        var packageDetails = PackageDetails_1.getPackageDetailsFromPatchFilename(filename);
        if (!packageDetails) {
            console.warn("Unrecognized patch file in patches directory " + filename);
            return;
        }
        var name = packageDetails.name, version = packageDetails.version, path = packageDetails.path, pathSpecifier = packageDetails.pathSpecifier, isDevOnly = packageDetails.isDevOnly, patchFilename = packageDetails.patchFilename;
        var installedPackageVersion = getInstalledPackageVersion({
            appPath: appPath,
            path: path,
            pathSpecifier: pathSpecifier,
            isDevOnly: isDevOnly ||
                // check for direct-dependents in prod
                (process.env.NODE_ENV === "production" &&
                    packageIsDevDependency_1.packageIsDevDependency({ appPath: appPath, packageDetails: packageDetails })),
            patchFilename: patchFilename,
        });
        if (!installedPackageVersion) {
            // it's ok we're in production mode and this is a dev only package
            console.log("Skipping dev-only " + chalk_1.default.bold(pathSpecifier) + "@" + version + " " + chalk_1.default.blue("✔"));
            return;
        }
        if (applyPatch({
            patchFilePath: path_1.resolve(patchesDirectory, filename),
            reverse: reverse,
            packageDetails: packageDetails,
            patchDir: patchDir,
        })) {
            // yay patch was applied successfully
            // print warning if version mismatch
            if (installedPackageVersion !== version.replace(/\.dev$/, "")) {
                printVersionMismatchWarning({
                    packageName: name,
                    actualVersion: installedPackageVersion,
                    originalVersion: version,
                    pathSpecifier: pathSpecifier,
                    path: path,
                });
            }
            else {
                console.log(chalk_1.default.bold(pathSpecifier) + "@" + version + " " + chalk_1.default.green("✔"));
            }
        }
        else {
            // completely failed to apply patch
            // TODO: propagate useful error messages from patch application
            if (installedPackageVersion === version) {
                printBrokenPatchFileError({
                    packageName: name,
                    patchFileName: filename,
                    pathSpecifier: pathSpecifier,
                    path: path,
                });
            }
            else {
                printPatchApplictionFailureError({
                    packageName: name,
                    actualVersion: installedPackageVersion,
                    originalVersion: version,
                    patchFileName: filename,
                    path: path,
                    pathSpecifier: pathSpecifier,
                });
            }
            exit();
        }
    });
}
exports.applyPatchesForApp = applyPatchesForApp;
function applyPatch(_a) {
    var patchFilePath = _a.patchFilePath, reverse = _a.reverse, packageDetails = _a.packageDetails, patchDir = _a.patchDir;
    var patch = read_1.readPatch({ patchFilePath: patchFilePath, packageDetails: packageDetails, patchDir: patchDir });
    try {
        apply_1.executeEffects(reverse ? reverse_1.reversePatch(patch) : patch, { dryRun: false });
    }
    catch (e) {
        try {
            apply_1.executeEffects(reverse ? patch : reverse_1.reversePatch(patch), { dryRun: true });
        }
        catch (e) {
            return false;
        }
    }
    return true;
}
exports.applyPatch = applyPatch;
function printVersionMismatchWarning(_a) {
    var packageName = _a.packageName, actualVersion = _a.actualVersion, originalVersion = _a.originalVersion, pathSpecifier = _a.pathSpecifier, path = _a.path;
    console.warn("\n" + chalk_1.default.red("Warning:") + " patch-package detected a patch file version mismatch\n\n  Don't worry! This is probably fine. The patch was still applied\n  successfully. Here's the deets:\n\n  Patch file created for\n\n    " + packageName + "@" + chalk_1.default.bold(originalVersion) + "\n\n  applied to\n\n    " + packageName + "@" + chalk_1.default.bold(actualVersion) + "\n  \n  At path\n  \n    " + path + "\n\n  This warning is just to give you a heads-up. There is a small chance of\n  breakage even though the patch was applied successfully. Make sure the package\n  still behaves like you expect (you wrote tests, right?) and then run\n\n    " + chalk_1.default.bold("patch-package " + pathSpecifier) + "\n\n  to update the version in the patch file name and make this warning go away.\n");
}
function printBrokenPatchFileError(_a) {
    var packageName = _a.packageName, patchFileName = _a.patchFileName, path = _a.path, pathSpecifier = _a.pathSpecifier;
    console.error("\n" + chalk_1.default.red.bold("**ERROR**") + " " + chalk_1.default.red("Failed to apply patch for package " + chalk_1.default.bold(packageName) + " at path") + "\n  \n    " + path + "\n\n  This error was caused because patch-package cannot apply the following patch file:\n\n    patches/" + patchFileName + "\n\n  Try removing node_modules and trying again. If that doesn't work, maybe there was\n  an accidental change made to the patch file? Try recreating it by manually\n  editing the appropriate files and running:\n  \n    patch-package " + pathSpecifier + "\n  \n  If that doesn't work, then it's a bug in patch-package, so please submit a bug\n  report. Thanks!\n\n    https://github.com/ds300/patch-package/issues\n    \n");
}
function printPatchApplictionFailureError(_a) {
    var packageName = _a.packageName, actualVersion = _a.actualVersion, originalVersion = _a.originalVersion, patchFileName = _a.patchFileName, path = _a.path, pathSpecifier = _a.pathSpecifier;
    console.error("\n" + chalk_1.default.red.bold("**ERROR**") + " " + chalk_1.default.red("Failed to apply patch for package " + chalk_1.default.bold(packageName) + " at path") + "\n  \n    " + path + "\n\n  This error was caused because " + chalk_1.default.bold(packageName) + " has changed since you\n  made the patch file for it. This introduced conflicts with your patch,\n  just like a merge conflict in Git when separate incompatible changes are\n  made to the same piece of code.\n\n  Maybe this means your patch file is no longer necessary, in which case\n  hooray! Just delete it!\n\n  Otherwise, you need to generate a new patch file.\n\n  To generate a new one, just repeat the steps you made to generate the first\n  one.\n\n  i.e. manually make the appropriate file changes, then run \n\n    patch-package " + pathSpecifier + "\n\n  Info:\n    Patch file: patches/" + patchFileName + "\n    Patch was made for version: " + chalk_1.default.green.bold(originalVersion) + "\n    Installed version: " + chalk_1.default.red.bold(actualVersion) + "\n");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbHlQYXRjaGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2FwcGx5UGF0Y2hlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGdEQUF5QjtBQUN6QixxQ0FBeUM7QUFDekMsdUNBQThDO0FBQzlDLHFDQUFxQztBQUNyQywrQkFBZ0Q7QUFDaEQsNkJBQTRCO0FBQzVCLG1EQUd5QjtBQUN6QiwyQ0FBOEM7QUFDOUMsZ0RBQXdCO0FBQ3hCLGtEQUEyQjtBQUMzQixxQ0FBd0M7QUFDeEMsbUVBQWlFO0FBRWpFLCtDQUErQztBQUMvQyx1REFBdUQ7QUFDdkQsSUFBTSw4QkFBOEIsR0FBRyxlQUFJLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssTUFBTSxDQUFBO0FBRTlFLElBQU0sSUFBSSxHQUFHLGNBQU0sT0FBQSxPQUFPLENBQUMsSUFBSSxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFwRCxDQUFvRCxDQUFBO0FBRXZFLFNBQVMsY0FBYyxDQUFDLGdCQUF3QjtJQUM5QyxJQUFJLENBQUMscUJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1FBQ2pDLE9BQU8sRUFBRSxDQUFBO0tBQ1Y7SUFFRCxPQUFPLHVCQUFhLENBQUMsZ0JBQWdCLENBQWEsQ0FBQTtBQUNwRCxDQUFDO0FBRUQsU0FBUywwQkFBMEIsQ0FBQyxFQVluQztRQVhDLG9CQUFPLEVBQ1AsY0FBSSxFQUNKLGdDQUFhLEVBQ2Isd0JBQVMsRUFDVCxnQ0FBYTtJQVFiLElBQU0sVUFBVSxHQUFHLFdBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFDdEMsSUFBSSxDQUFDLHFCQUFVLENBQUMsVUFBVSxDQUFDLEVBQUU7UUFDM0IsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsS0FBSyxZQUFZLElBQUksU0FBUyxFQUFFO1lBQ3RELE9BQU8sSUFBSSxDQUFB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Q0FBQyxhQUFVLENBQ3ZFLGtCQUVHLElBQUksZ0hBSUksYUFBYSxtUEFNUCxhQUFhLDJLQU9oQyxDQUFDLENBQUE7QUFDRixDQUFDO0FBRUQsU0FBUyxnQ0FBZ0MsQ0FBQyxFQWN6QztRQWJDLDRCQUFXLEVBQ1gsZ0NBQWEsRUFDYixvQ0FBZSxFQUNmLGdDQUFhLEVBQ2IsY0FBSSxFQUNKLGdDQUFhO0lBU2IsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUNkLGVBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFJLGVBQUssQ0FBQyxHQUFHLENBQ3RDLHVDQUFxQyxlQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxhQUFVLENBQ3ZFLGtCQUVHLElBQUksNENBRXdCLGVBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLG9pQkFlckMsYUFBYSw2Q0FHUCxhQUFhLDBDQUNMLGVBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxpQ0FDMUMsZUFBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQ3JELENBQUMsQ0FBQTtBQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgY2hhbGsgZnJvbSBcImNoYWxrXCJcbmltcG9ydCB7IGdldFBhdGNoRmlsZXMgfSBmcm9tIFwiLi9wYXRjaEZzXCJcbmltcG9ydCB7IGV4ZWN1dGVFZmZlY3RzIH0gZnJvbSBcIi4vcGF0Y2gvYXBwbHlcIlxuaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gXCJmcy1leHRyYVwiXG5pbXBvcnQgeyBqb2luLCByZXNvbHZlLCByZWxhdGl2ZSB9IGZyb20gXCIuL3BhdGhcIlxuaW1wb3J0IHsgcG9zaXggfSBmcm9tIFwicGF0aFwiXG5pbXBvcnQge1xuICBnZXRQYWNrYWdlRGV0YWlsc0Zyb21QYXRjaEZpbGVuYW1lLFxuICBQYWNrYWdlRGV0YWlscyxcbn0gZnJvbSBcIi4vUGFja2FnZURldGFpbHNcIlxuaW1wb3J0IHsgcmV2ZXJzZVBhdGNoIH0gZnJvbSBcIi4vcGF0Y2gvcmV2ZXJzZVwiXG5pbXBvcnQgaXNDaSBmcm9tIFwiaXMtY2lcIlxuaW1wb3J0IHNlbXZlciBmcm9tIFwic2VtdmVyXCJcbmltcG9ydCB7IHJlYWRQYXRjaCB9IGZyb20gXCIuL3BhdGNoL3JlYWRcIlxuaW1wb3J0IHsgcGFja2FnZUlzRGV2RGVwZW5kZW5jeSB9IGZyb20gXCIuL3BhY2thZ2VJc0RldkRlcGVuZGVuY3lcIlxuXG4vLyBkb24ndCB3YW50IHRvIGV4aXQoMSkgb24gcG9zdGluc2FsbCBsb2NhbGx5LlxuLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kczMwMC9wYXRjaC1wYWNrYWdlL2lzc3Vlcy84NlxuY29uc3Qgc2hvdWxkRXhpdFBvc3RpbnN0YWxsV2l0aEVycm9yID0gaXNDaSB8fCBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gXCJ0ZXN0XCJcblxuY29uc3QgZXhpdCA9ICgpID0+IHByb2Nlc3MuZXhpdChzaG91bGRFeGl0UG9zdGluc3RhbGxXaXRoRXJyb3IgPyAxIDogMClcblxuZnVuY3Rpb24gZmluZFBhdGNoRmlsZXMocGF0Y2hlc0RpcmVjdG9yeTogc3RyaW5nKTogc3RyaW5nW10ge1xuICBpZiAoIWV4aXN0c1N5bmMocGF0Y2hlc0RpcmVjdG9yeSkpIHtcbiAgICByZXR1cm4gW11cbiAgfVxuXG4gIHJldHVybiBnZXRQYXRjaEZpbGVzKHBhdGNoZXNEaXJlY3RvcnkpIGFzIHN0cmluZ1tdXG59XG5cbmZ1bmN0aW9uIGdldEluc3RhbGxlZFBhY2thZ2VWZXJzaW9uKHtcbiAgYXBwUGF0aCxcbiAgcGF0aCxcbiAgcGF0aFNwZWNpZmllcixcbiAgaXNEZXZPbmx5LFxuICBwYXRjaEZpbGVuYW1lLFxufToge1xuICBhcHBQYXRoOiBzdHJpbmdcbiAgcGF0aDogc3RyaW5nXG4gIHBhdGhTcGVjaWZpZXI6IHN0cmluZ1xuICBpc0Rldk9ubHk6IGJvb2xlYW5cbiAgcGF0Y2hGaWxlbmFtZTogc3RyaW5nXG59KTogbnVsbCB8IHN0cmluZyB7XG4gIGNvbnN0IHBhY2thZ2VEaXIgPSBqb2luKGFwcFBhdGgsIHBhdGgpXG4gIGlmICghZXhpc3RzU3luYyhwYWNrYWdlRGlyKSkge1xuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gXCJwcm9kdWN0aW9uXCIgJiYgaXNEZXZPbmx5KSB7XG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYCR7Y2hhbGsucmVkKFwiRXJyb3I6XCIpfSBQYXRjaCBmaWxlIGZvdW5kIGZvciBwYWNrYWdlICR7cG9zaXguYmFzZW5hbWUoXG4gICAgICAgIHBhdGhTcGVjaWZpZXIsXG4gICAgICApfWAgKyBgIHdoaWNoIGlzIG5vdCBwcmVzZW50IGF0ICR7cmVsYXRpdmUoXCIuXCIsIHBhY2thZ2VEaXIpfWAsXG4gICAgKVxuXG4gICAgaWYgKCFpc0Rldk9ubHkgJiYgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBgXG4gIElmIHRoaXMgcGFja2FnZSBpcyBhIGRldiBkZXBlbmRlbmN5LCByZW5hbWUgdGhlIHBhdGNoIGZpbGUgdG9cbiAgXG4gICAgJHtjaGFsay5ib2xkKHBhdGNoRmlsZW5hbWUucmVwbGFjZShcIi5wYXRjaFwiLCBcIi5kZXYucGF0Y2hcIikpfVxuYCxcbiAgICAgIClcbiAgICB9XG5cbiAgICBleGl0KClcbiAgfVxuXG4gIGNvbnN0IHsgdmVyc2lvbiB9ID0gcmVxdWlyZShqb2luKHBhY2thZ2VEaXIsIFwicGFja2FnZS5qc29uXCIpKVxuICAvLyBub3JtYWxpemUgdmVyc2lvbiBmb3IgYG5wbSBjaWBcbiAgY29uc3QgcmVzdWx0ID0gc2VtdmVyLnZhbGlkKHZlcnNpb24pXG4gIGlmIChyZXN1bHQgPT09IG51bGwpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYCR7Y2hhbGsucmVkKFxuICAgICAgICBcIkVycm9yOlwiLFxuICAgICAgKX0gVmVyc2lvbiBzdHJpbmcgJyR7dmVyc2lvbn0nIGNhbm5vdCBiZSBwYXJzZWQgZnJvbSAke2pvaW4oXG4gICAgICAgIHBhY2thZ2VEaXIsXG4gICAgICAgIFwicGFja2FnZS5qc29uXCIsXG4gICAgICApfWAsXG4gICAgKVxuXG4gICAgZXhpdCgpXG4gIH1cblxuICByZXR1cm4gcmVzdWx0IGFzIHN0cmluZ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlQYXRjaGVzRm9yQXBwKHtcbiAgYXBwUGF0aCxcbiAgcmV2ZXJzZSxcbiAgcGF0Y2hEaXIsXG59OiB7XG4gIGFwcFBhdGg6IHN0cmluZ1xuICByZXZlcnNlOiBib29sZWFuXG4gIHBhdGNoRGlyOiBzdHJpbmdcbn0pOiB2b2lkIHtcbiAgY29uc3QgcGF0Y2hlc0RpcmVjdG9yeSA9IGpvaW4oYXBwUGF0aCwgcGF0Y2hEaXIpXG4gIGNvbnN0IGZpbGVzID0gZmluZFBhdGNoRmlsZXMocGF0Y2hlc0RpcmVjdG9yeSlcblxuICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgY29uc29sZS5lcnJvcihjaGFsay5yZWQoXCJObyBwYXRjaCBmaWxlcyBmb3VuZFwiKSlcbiAgICByZXR1cm5cbiAgfVxuXG4gIGZpbGVzLmZvckVhY2goZmlsZW5hbWUgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VEZXRhaWxzID0gZ2V0UGFja2FnZURldGFpbHNGcm9tUGF0Y2hGaWxlbmFtZShmaWxlbmFtZSlcblxuICAgIGlmICghcGFja2FnZURldGFpbHMpIHtcbiAgICAgIGNvbnNvbGUud2FybihgVW5yZWNvZ25pemVkIHBhdGNoIGZpbGUgaW4gcGF0Y2hlcyBkaXJlY3RvcnkgJHtmaWxlbmFtZX1gKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgY29uc3Qge1xuICAgICAgbmFtZSxcbiAgICAgIHZlcnNpb24sXG4gICAgICBwYXRoLFxuICAgICAgcGF0aFNwZWNpZmllcixcbiAgICAgIGlzRGV2T25seSxcbiAgICAgIHBhdGNoRmlsZW5hbWUsXG4gICAgfSA9IHBhY2thZ2VEZXRhaWxzXG5cbiAgICBjb25zdCBpbnN0YWxsZWRQYWNrYWdlVmVyc2lvbiA9IGdldEluc3RhbGxlZFBhY2thZ2VWZXJzaW9uKHtcbiAgICAgIGFwcFBhdGgsXG4gICAgICBwYXRoLFxuICAgICAgcGF0aFNwZWNpZmllcixcbiAgICAgIGlzRGV2T25seTpcbiAgICAgICAgaXNEZXZPbmx5IHx8XG4gICAgICAgIC8vIGNoZWNrIGZvciBkaXJlY3QtZGVwZW5kZW50cyBpbiBwcm9kXG4gICAgICAgIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gXCJwcm9kdWN0aW9uXCIgJiZcbiAgICAgICAgICBwYWNrYWdlSXNEZXZEZXBlbmRlbmN5KHsgYXBwUGF0aCwgcGFja2FnZURldGFpbHMgfSkpLFxuICAgICAgcGF0Y2hGaWxlbmFtZSxcbiAgICB9KVxuICAgIGlmICghaW5zdGFsbGVkUGFja2FnZVZlcnNpb24pIHtcbiAgICAgIC8vIGl0J3Mgb2sgd2UncmUgaW4gcHJvZHVjdGlvbiBtb2RlIGFuZCB0aGlzIGlzIGEgZGV2IG9ubHkgcGFja2FnZVxuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgIGBTa2lwcGluZyBkZXYtb25seSAke2NoYWxrLmJvbGQocGF0aFNwZWNpZmllcil9QCR7dmVyc2lvbn0gJHtjaGFsay5ibHVlKFxuICAgICAgICAgIFwi4pyUXCIsXG4gICAgICAgICl9YCxcbiAgICAgIClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmIChcbiAgICAgIGFwcGx5UGF0Y2goe1xuICAgICAgICBwYXRjaEZpbGVQYXRoOiByZXNvbHZlKHBhdGNoZXNEaXJlY3RvcnksIGZpbGVuYW1lKSBhcyBzdHJpbmcsXG4gICAgICAgIHJldmVyc2UsXG4gICAgICAgIHBhY2thZ2VEZXRhaWxzLFxuICAgICAgICBwYXRjaERpcixcbiAgICAgIH0pXG4gICAgKSB7XG4gICAgICAvLyB5YXkgcGF0Y2ggd2FzIGFwcGxpZWQgc3VjY2Vzc2Z1bGx5XG4gICAgICAvLyBwcmludCB3YXJuaW5nIGlmIHZlcnNpb24gbWlzbWF0Y2hcbiAgICAgIGlmIChpbnN0YWxsZWRQYWNrYWdlVmVyc2lvbiAhPT0gdmVyc2lvbi5yZXBsYWNlKC9cXC5kZXYkLywgXCJcIikpIHtcbiAgICAgICAgcHJpbnRWZXJzaW9uTWlzbWF0Y2hXYXJuaW5nKHtcbiAgICAgICAgICBwYWNrYWdlTmFtZTogbmFtZSxcbiAgICAgICAgICBhY3R1YWxWZXJzaW9uOiBpbnN0YWxsZWRQYWNrYWdlVmVyc2lvbixcbiAgICAgICAgICBvcmlnaW5hbFZlcnNpb246IHZlcnNpb24sXG4gICAgICAgICAgcGF0aFNwZWNpZmllcixcbiAgICAgICAgICBwYXRoLFxuICAgICAgICB9KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgYCR7Y2hhbGsuYm9sZChwYXRoU3BlY2lmaWVyKX1AJHt2ZXJzaW9ufSAke2NoYWxrLmdyZWVuKFwi4pyUXCIpfWAsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY29tcGxldGVseSBmYWlsZWQgdG8gYXBwbHkgcGF0Y2hcbiAgICAgIC8vIFRPRE86IHByb3BhZ2F0ZSB1c2VmdWwgZXJyb3IgbWVzc2FnZXMgZnJvbSBwYXRjaCBhcHBsaWNhdGlvblxuICAgICAgaWYgKGluc3RhbGxlZFBhY2thZ2VWZXJzaW9uID09PSB2ZXJzaW9uKSB7XG4gICAgICAgIHByaW50QnJva2VuUGF0Y2hGaWxlRXJyb3Ioe1xuICAgICAgICAgIHBhY2thZ2VOYW1lOiBuYW1lLFxuICAgICAgICAgIHBhdGNoRmlsZU5hbWU6IGZpbGVuYW1lLFxuICAgICAgICAgIHBhdGhTcGVjaWZpZXIsXG4gICAgICAgICAgcGF0aCxcbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHByaW50UGF0Y2hBcHBsaWN0aW9uRmFpbHVyZUVycm9yKHtcbiAgICAgICAgICBwYWNrYWdlTmFtZTogbmFtZSxcbiAgICAgICAgICBhY3R1YWxWZXJzaW9uOiBpbnN0YWxsZWRQYWNrYWdlVmVyc2lvbixcbiAgICAgICAgICBvcmlnaW5hbFZlcnNpb246IHZlcnNpb24sXG4gICAgICAgICAgcGF0Y2hGaWxlTmFtZTogZmlsZW5hbWUsXG4gICAgICAgICAgcGF0aCxcbiAgICAgICAgICBwYXRoU3BlY2lmaWVyLFxuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgICBleGl0KClcbiAgICB9XG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseVBhdGNoKHtcbiAgcGF0Y2hGaWxlUGF0aCxcbiAgcmV2ZXJzZSxcbiAgcGFja2FnZURldGFpbHMsXG4gIHBhdGNoRGlyLFxufToge1xuICBwYXRjaEZpbGVQYXRoOiBzdHJpbmdcbiAgcmV2ZXJzZTogYm9vbGVhblxuICBwYWNrYWdlRGV0YWlsczogUGFja2FnZURldGFpbHNcbiAgcGF0Y2hEaXI6IHN0cmluZ1xufSk6IGJvb2xlYW4ge1xuICBjb25zdCBwYXRjaCA9IHJlYWRQYXRjaCh7IHBhdGNoRmlsZVBhdGgsIHBhY2thZ2VEZXRhaWxzLCBwYXRjaERpciB9KVxuICB0cnkge1xuICAgIGV4ZWN1dGVFZmZlY3RzKHJldmVyc2UgPyByZXZlcnNlUGF0Y2gocGF0Y2gpIDogcGF0Y2gsIHsgZHJ5UnVuOiBmYWxzZSB9KVxuICB9IGNhdGNoIChlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV4ZWN1dGVFZmZlY3RzKHJldmVyc2UgPyBwYXRjaCA6IHJldmVyc2VQYXRjaChwYXRjaCksIHsgZHJ5UnVuOiB0cnVlIH0pXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRydWVcbn1cblxuZnVuY3Rpb24gcHJpbnRWZXJzaW9uTWlzbWF0Y2hXYXJuaW5nKHtcbiAgcGFja2FnZU5hbWUsXG4gIGFjdHVhbFZlcnNpb24sXG4gIG9yaWdpbmFsVmVyc2lvbixcbiAgcGF0aFNwZWNpZmllcixcbiAgcGF0aCxcbn06IHtcbiAgcGFja2FnZU5hbWU6IHN0cmluZ1xuICBhY3R1YWxWZXJzaW9uOiBzdHJpbmdcbiAgb3JpZ2luYWxWZXJzaW9uOiBzdHJpbmdcbiAgcGF0aFNwZWNpZmllcjogc3RyaW5nXG4gIHBhdGg6IHN0cmluZ1xufSkge1xuICBjb25zb2xlLndhcm4oYFxuJHtjaGFsay5yZWQoXCJXYXJuaW5nOlwiKX0gcGF0Y2gtcGFja2FnZSBkZXRlY3RlZCBhIHBhdGNoIGZpbGUgdmVyc2lvbiBtaXNtYXRjaFxuXG4gIERvbid0IHdvcnJ5ISBUaGlzIGlzIHByb2JhYmx5IGZpbmUuIFRoZSBwYXRjaCB3YXMgc3RpbGwgYXBwbGllZFxuICBzdWNjZXNzZnVsbHkuIEhlcmUncyB0aGUgZGVldHM6XG5cbiAgUGF0Y2ggZmlsZSBjcmVhdGVkIGZvclxuXG4gICAgJHtwYWNrYWdlTmFtZX1AJHtjaGFsay5ib2xkKG9yaWdpbmFsVmVyc2lvbil9XG5cbiAgYXBwbGllZCB0b1xuXG4gICAgJHtwYWNrYWdlTmFtZX1AJHtjaGFsay5ib2xkKGFjdHVhbFZlcnNpb24pfVxuICBcbiAgQXQgcGF0aFxuICBcbiAgICAke3BhdGh9XG5cbiAgVGhpcyB3YXJuaW5nIGlzIGp1c3QgdG8gZ2l2ZSB5b3UgYSBoZWFkcy11cC4gVGhlcmUgaXMgYSBzbWFsbCBjaGFuY2Ugb2ZcbiAgYnJlYWthZ2UgZXZlbiB0aG91Z2ggdGhlIHBhdGNoIHdhcyBhcHBsaWVkIHN1Y2Nlc3NmdWxseS4gTWFrZSBzdXJlIHRoZSBwYWNrYWdlXG4gIHN0aWxsIGJlaGF2ZXMgbGlrZSB5b3UgZXhwZWN0ICh5b3Ugd3JvdGUgdGVzdHMsIHJpZ2h0PykgYW5kIHRoZW4gcnVuXG5cbiAgICAke2NoYWxrLmJvbGQoYHBhdGNoLXBhY2thZ2UgJHtwYXRoU3BlY2lmaWVyfWApfVxuXG4gIHRvIHVwZGF0ZSB0aGUgdmVyc2lvbiBpbiB0aGUgcGF0Y2ggZmlsZSBuYW1lIGFuZCBtYWtlIHRoaXMgd2FybmluZyBnbyBhd2F5LlxuYClcbn1cblxuZnVuY3Rpb24gcHJpbnRCcm9rZW5QYXRjaEZpbGVFcnJvcih7XG4gIHBhY2thZ2VOYW1lLFxuICBwYXRjaEZpbGVOYW1lLFxuICBwYXRoLFxuICBwYXRoU3BlY2lmaWVyLFxufToge1xuICBwYWNrYWdlTmFtZTogc3RyaW5nXG4gIHBhdGNoRmlsZU5hbWU6IHN0cmluZ1xuICBwYXRoOiBzdHJpbmdcbiAgcGF0aFNwZWNpZmllcjogc3RyaW5nXG59KSB7XG4gIGNvbnNvbGUuZXJyb3IoYFxuJHtjaGFsay5yZWQuYm9sZChcIioqRVJST1IqKlwiKX0gJHtjaGFsay5yZWQoXG4gICAgYEZhaWxlZCB0byBhcHBseSBwYXRjaCBmb3IgcGFja2FnZSAke2NoYWxrLmJvbGQocGFja2FnZU5hbWUpfSBhdCBwYXRoYCxcbiAgKX1cbiAgXG4gICAgJHtwYXRofVxuXG4gIFRoaXMgZXJyb3Igd2FzIGNhdXNlZCBiZWNhdXNlIHBhdGNoLXBhY2thZ2UgY2Fubm90IGFwcGx5IHRoZSBmb2xsb3dpbmcgcGF0Y2ggZmlsZTpcblxuICAgIHBhdGNoZXMvJHtwYXRjaEZpbGVOYW1lfVxuXG4gIFRyeSByZW1vdmluZyBub2RlX21vZHVsZXMgYW5kIHRyeWluZyBhZ2Fpbi4gSWYgdGhhdCBkb2Vzbid0IHdvcmssIG1heWJlIHRoZXJlIHdhc1xuICBhbiBhY2NpZGVudGFsIGNoYW5nZSBtYWRlIHRvIHRoZSBwYXRjaCBmaWxlPyBUcnkgcmVjcmVhdGluZyBpdCBieSBtYW51YWxseVxuICBlZGl0aW5nIHRoZSBhcHByb3ByaWF0ZSBmaWxlcyBhbmQgcnVubmluZzpcbiAgXG4gICAgcGF0Y2gtcGFja2FnZSAke3BhdGhTcGVjaWZpZXJ9XG4gIFxuICBJZiB0aGF0IGRvZXNuJ3Qgd29yaywgdGhlbiBpdCdzIGEgYnVnIGluIHBhdGNoLXBhY2thZ2UsIHNvIHBsZWFzZSBzdWJtaXQgYSBidWdcbiAgcmVwb3J0LiBUaGFua3MhXG5cbiAgICBodHRwczovL2dpdGh1Yi5jb20vZHMzMDAvcGF0Y2gtcGFja2FnZS9pc3N1ZXNcbiAgICBcbmApXG59XG5cbmZ1bmN0aW9uIHByaW50UGF0Y2hBcHBsaWN0aW9uRmFpbHVyZUVycm9yKHtcbiAgcGFja2FnZU5hbWUsXG4gIGFjdHVhbFZlcnNpb24sXG4gIG9yaWdpbmFsVmVyc2lvbixcbiAgcGF0Y2hGaWxlTmFtZSxcbiAgcGF0aCxcbiAgcGF0aFNwZWNpZmllcixcbn06IHtcbiAgcGFja2FnZU5hbWU6IHN0cmluZ1xuICBhY3R1YWxWZXJzaW9uOiBzdHJpbmdcbiAgb3JpZ2luYWxWZXJzaW9uOiBzdHJpbmdcbiAgcGF0Y2hGaWxlTmFtZTogc3RyaW5nXG4gIHBhdGg6IHN0cmluZ1xuICBwYXRoU3BlY2lmaWVyOiBzdHJpbmdcbn0pIHtcbiAgY29uc29sZS5lcnJvcihgXG4ke2NoYWxrLnJlZC5ib2xkKFwiKipFUlJPUioqXCIpfSAke2NoYWxrLnJlZChcbiAgICBgRmFpbGVkIHRvIGFwcGx5IHBhdGNoIGZvciBwYWNrYWdlICR7Y2hhbGsuYm9sZChwYWNrYWdlTmFtZSl9IGF0IHBhdGhgLFxuICApfVxuICBcbiAgICAke3BhdGh9XG5cbiAgVGhpcyBlcnJvciB3YXMgY2F1c2VkIGJlY2F1c2UgJHtjaGFsay5ib2xkKHBhY2thZ2VOYW1lKX0gaGFzIGNoYW5nZWQgc2luY2UgeW91XG4gIG1hZGUgdGhlIHBhdGNoIGZpbGUgZm9yIGl0LiBUaGlzIGludHJvZHVjZWQgY29uZmxpY3RzIHdpdGggeW91ciBwYXRjaCxcbiAganVzdCBsaWtlIGEgbWVyZ2UgY29uZmxpY3QgaW4gR2l0IHdoZW4gc2VwYXJhdGUgaW5jb21wYXRpYmxlIGNoYW5nZXMgYXJlXG4gIG1hZGUgdG8gdGhlIHNhbWUgcGllY2Ugb2YgY29kZS5cblxuICBNYXliZSB0aGlzIG1lYW5zIHlvdXIgcGF0Y2ggZmlsZSBpcyBubyBsb25nZXIgbmVjZXNzYXJ5LCBpbiB3aGljaCBjYXNlXG4gIGhvb3JheSEgSnVzdCBkZWxldGUgaXQhXG5cbiAgT3RoZXJ3aXNlLCB5b3UgbmVlZCB0byBnZW5lcmF0ZSBhIG5ldyBwYXRjaCBmaWxlLlxuXG4gIFRvIGdlbmVyYXRlIGEgbmV3IG9uZSwganVzdCByZXBlYXQgdGhlIHN0ZXBzIHlvdSBtYWRlIHRvIGdlbmVyYXRlIHRoZSBmaXJzdFxuICBvbmUuXG5cbiAgaS5lLiBtYW51YWxseSBtYWtlIHRoZSBhcHByb3ByaWF0ZSBmaWxlIGNoYW5nZXMsIHRoZW4gcnVuIFxuXG4gICAgcGF0Y2gtcGFja2FnZSAke3BhdGhTcGVjaWZpZXJ9XG5cbiAgSW5mbzpcbiAgICBQYXRjaCBmaWxlOiBwYXRjaGVzLyR7cGF0Y2hGaWxlTmFtZX1cbiAgICBQYXRjaCB3YXMgbWFkZSBmb3IgdmVyc2lvbjogJHtjaGFsay5ncmVlbi5ib2xkKG9yaWdpbmFsVmVyc2lvbil9XG4gICAgSW5zdGFsbGVkIHZlcnNpb246ICR7Y2hhbGsucmVkLmJvbGQoYWN0dWFsVmVyc2lvbil9XG5gKVxufVxuIl19