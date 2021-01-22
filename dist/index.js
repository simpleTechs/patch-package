"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = __importDefault(require("chalk"));
var process_1 = __importDefault(require("process"));
var minimist_1 = __importDefault(require("minimist"));
var applyPatches_1 = require("./applyPatches");
var getAppRootPath_1 = require("./getAppRootPath");
var makePatch_1 = require("./makePatch");
var makeRegExp_1 = require("./makeRegExp");
var detectPackageManager_1 = require("./detectPackageManager");
var path_1 = require("./path");
var path_2 = require("path");
var slash = require("slash");
var appPath = getAppRootPath_1.getAppRootPath();
var argv = minimist_1.default(process_1.default.argv.slice(2), {
    boolean: [
        "use-yarn",
        "case-sensitive-path-filtering",
        "reverse",
        "help",
        "version",
    ],
    string: ["patch-dir"],
});
var packageNames = argv._;
console.log(chalk_1.default.bold("patch-package"), 
// tslint:disable-next-line:no-var-requires
require(path_1.join(__dirname, "../package.json")).version);
if (argv.version || argv.v) {
    // noop
}
else if (argv.help || argv.h) {
    printHelp();
}
else {
    var patchDir_1 = slash(path_2.normalize((argv["patch-dir"] || "patches") + path_2.sep));
    if (patchDir_1.startsWith("/")) {
        throw new Error("--patch-dir must be a relative path");
    }
    if (packageNames.length) {
        var includePaths_1 = makeRegExp_1.makeRegExp(argv.include, "include", /.*/, argv["case-sensitive-path-filtering"]);
        var excludePaths_1 = makeRegExp_1.makeRegExp(argv.exclude, "exclude", /package\.json$/, argv["case-sensitive-path-filtering"]);
        var packageManager_1 = detectPackageManager_1.detectPackageManager(appPath, argv["use-yarn"] ? "yarn" : null);
        packageNames.forEach(function (packagePathSpecifier) {
            makePatch_1.makePatch({
                packagePathSpecifier: packagePathSpecifier,
                appPath: appPath,
                packageManager: packageManager_1,
                includePaths: includePaths_1,
                excludePaths: excludePaths_1,
                patchDir: patchDir_1,
            });
        });
    }
    else {
        console.log("Applying patches...");
        var reverse = !!argv["reverse"];
        applyPatches_1.applyPatchesForApp({ appPath: appPath, reverse: reverse, patchDir: patchDir_1 });
    }
}
function printHelp() {
    console.log("\nUsage:\n\n  1. Patching packages\n  ====================\n\n    " + chalk_1.default.bold("patch-package") + "\n\n  Without arguments, the " + chalk_1.default.bold("patch-package") + " command will attempt to find and apply\n  patch files to your project. It looks for files named like\n\n     ./patches/<package-name>+<version>.patch\n\n  2. Creating patch files\n  =======================\n\n    " + chalk_1.default.bold("patch-package") + " <package-name>" + chalk_1.default.italic("[ <package-name>]") + "\n\n  When given package names as arguments, patch-package will create patch files\n  based on any changes you've made to the versions installed by yarn/npm.\n\n  Options:\n\n     " + chalk_1.default.bold("--use-yarn") + "\n\n         By default, patch-package checks whether you use npm or yarn based on\n         which lockfile you have. If you have both, it uses npm by default.\n         Set this option to override that default and always use yarn.\n\n     " + chalk_1.default.bold("--exclude <regexp>") + "\n\n         Ignore paths matching the regexp when creating patch files.\n         Paths are relative to the root dir of the package to be patched.\n\n         Default: 'package\\.json$'\n\n     " + chalk_1.default.bold("--include <regexp>") + "\n\n         Only consider paths matching the regexp when creating patch files.\n         Paths are relative to the root dir of the package to be patched.\n\n         Default '.*'\n\n     " + chalk_1.default.bold("--case-sensitive-path-filtering") + "\n\n         Make regexps used in --include or --exclude filters case-sensitive.\n\n     " + chalk_1.default.bold("--patch-dir") + "\n\n         Specify the name for the directory in which to put the patch files.\n");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxnREFBeUI7QUFDekIsb0RBQTZCO0FBQzdCLHNEQUErQjtBQUUvQiwrQ0FBbUQ7QUFDbkQsbURBQWlEO0FBQ2pELHlDQUF1QztBQUN2QywyQ0FBeUM7QUFDekMsK0RBQTZEO0FBQzdELCtCQUE2QjtBQUM3Qiw2QkFBcUM7QUFDckMsNkJBQStCO0FBRS9CLElBQU0sT0FBTyxHQUFHLCtCQUFjLEVBQUUsQ0FBQTtBQUNoQyxJQUFNLElBQUksR0FBRyxrQkFBUSxDQUFDLGlCQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRTtJQUMzQyxPQUFPLEVBQUU7UUFDUCxVQUFVO1FBQ1YsK0JBQStCO1FBQy9CLFNBQVM7UUFDVCxNQUFNO1FBQ04sU0FBUztLQUNWO0lBQ0QsTUFBTSxFQUFFLENBQUMsV0FBVyxDQUFDO0NBQ3RCLENBQUMsQ0FBQTtBQUNGLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUE7QUFFM0IsT0FBTyxDQUFDLEdBQUcsQ0FDVCxlQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQztBQUMzQiwyQ0FBMkM7QUFDM0MsT0FBTyxDQUFDLFdBQUksQ0FBQyxTQUFTLEVBQUUsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FDcEQsQ0FBQTtBQUVELElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsQ0FBQyxFQUFFO0lBQzFCLE9BQU87Q0FDUjtLQUFNLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxFQUFFO0lBQzlCLFNBQVMsRUFBRSxDQUFBO0NBQ1o7S0FBTTtJQUNMLElBQU0sVUFBUSxHQUFHLEtBQUssQ0FBQyxnQkFBUyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxHQUFHLFVBQUcsQ0FBQyxDQUFDLENBQUE7SUFDekUsSUFBSSxVQUFRLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQzVCLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUMsQ0FBQTtLQUN2RDtJQUNELElBQUksWUFBWSxDQUFDLE1BQU0sRUFBRTtRQUN2QixJQUFNLGNBQVksR0FBRyx1QkFBVSxDQUM3QixJQUFJLENBQUMsT0FBTyxFQUNaLFNBQVMsRUFDVCxJQUFJLEVBQ0osSUFBSSxDQUFDLCtCQUErQixDQUFDLENBQ3RDLENBQUE7UUFDRCxJQUFNLGNBQVksR0FBRyx1QkFBVSxDQUM3QixJQUFJLENBQUMsT0FBTyxFQUNaLFNBQVMsRUFDVCxnQkFBZ0IsRUFDaEIsSUFBSSxDQUFDLCtCQUErQixDQUFDLENBQ3RDLENBQUE7UUFDRCxJQUFNLGdCQUFjLEdBQUcsMkNBQW9CLENBQ3pDLE9BQU8sRUFDUCxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUNqQyxDQUFBO1FBQ0QsWUFBWSxDQUFDLE9BQU8sQ0FBQyxVQUFDLG9CQUE0QjtZQUNoRCxxQkFBUyxDQUFDO2dCQUNSLG9CQUFvQixzQkFBQTtnQkFDcEIsT0FBTyxTQUFBO2dCQUNQLGNBQWMsa0JBQUE7Z0JBQ2QsWUFBWSxnQkFBQTtnQkFDWixZQUFZLGdCQUFBO2dCQUNaLFFBQVEsWUFBQTthQUNULENBQUMsQ0FBQTtRQUNKLENBQUMsQ0FBQyxDQUFBO0tBQ0g7U0FBTTtRQUNMLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQTtRQUNsQyxJQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFBO1FBQ2pDLGlDQUFrQixDQUFDLEVBQUUsT0FBTyxTQUFBLEVBQUUsT0FBTyxTQUFBLEVBQUUsUUFBUSxZQUFBLEVBQUUsQ0FBQyxDQUFBO0tBQ25EO0NBQ0Y7QUFFRCxTQUFTLFNBQVM7SUFDaEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1RUFNUixlQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxxQ0FFTixlQUFLLENBQUMsSUFBSSxDQUNqQyxlQUFlLENBQ2hCLDhOQVFHLGVBQUssQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLHVCQUFrQixlQUFLLENBQUMsTUFBTSxDQUMzRCxtQkFBbUIsQ0FDcEIsNExBT0ksZUFBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsd1BBTXhCLGVBQUssQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsMk1BT2hDLGVBQUssQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsb01BT2hDLGVBQUssQ0FBQyxJQUFJLENBQUMsaUNBQWlDLENBQUMsaUdBSTdDLGVBQUssQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLHVGQUcvQixDQUFDLENBQUE7QUFDRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGNoYWxrIGZyb20gXCJjaGFsa1wiXG5pbXBvcnQgcHJvY2VzcyBmcm9tIFwicHJvY2Vzc1wiXG5pbXBvcnQgbWluaW1pc3QgZnJvbSBcIm1pbmltaXN0XCJcblxuaW1wb3J0IHsgYXBwbHlQYXRjaGVzRm9yQXBwIH0gZnJvbSBcIi4vYXBwbHlQYXRjaGVzXCJcbmltcG9ydCB7IGdldEFwcFJvb3RQYXRoIH0gZnJvbSBcIi4vZ2V0QXBwUm9vdFBhdGhcIlxuaW1wb3J0IHsgbWFrZVBhdGNoIH0gZnJvbSBcIi4vbWFrZVBhdGNoXCJcbmltcG9ydCB7IG1ha2VSZWdFeHAgfSBmcm9tIFwiLi9tYWtlUmVnRXhwXCJcbmltcG9ydCB7IGRldGVjdFBhY2thZ2VNYW5hZ2VyIH0gZnJvbSBcIi4vZGV0ZWN0UGFja2FnZU1hbmFnZXJcIlxuaW1wb3J0IHsgam9pbiB9IGZyb20gXCIuL3BhdGhcIlxuaW1wb3J0IHsgbm9ybWFsaXplLCBzZXAgfSBmcm9tIFwicGF0aFwiXG5pbXBvcnQgc2xhc2ggPSByZXF1aXJlKFwic2xhc2hcIilcblxuY29uc3QgYXBwUGF0aCA9IGdldEFwcFJvb3RQYXRoKClcbmNvbnN0IGFyZ3YgPSBtaW5pbWlzdChwcm9jZXNzLmFyZ3Yuc2xpY2UoMiksIHtcbiAgYm9vbGVhbjogW1xuICAgIFwidXNlLXlhcm5cIixcbiAgICBcImNhc2Utc2Vuc2l0aXZlLXBhdGgtZmlsdGVyaW5nXCIsXG4gICAgXCJyZXZlcnNlXCIsXG4gICAgXCJoZWxwXCIsXG4gICAgXCJ2ZXJzaW9uXCIsXG4gIF0sXG4gIHN0cmluZzogW1wicGF0Y2gtZGlyXCJdLFxufSlcbmNvbnN0IHBhY2thZ2VOYW1lcyA9IGFyZ3YuX1xuXG5jb25zb2xlLmxvZyhcbiAgY2hhbGsuYm9sZChcInBhdGNoLXBhY2thZ2VcIiksXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby12YXItcmVxdWlyZXNcbiAgcmVxdWlyZShqb2luKF9fZGlybmFtZSwgXCIuLi9wYWNrYWdlLmpzb25cIikpLnZlcnNpb24sXG4pXG5cbmlmIChhcmd2LnZlcnNpb24gfHwgYXJndi52KSB7XG4gIC8vIG5vb3Bcbn0gZWxzZSBpZiAoYXJndi5oZWxwIHx8IGFyZ3YuaCkge1xuICBwcmludEhlbHAoKVxufSBlbHNlIHtcbiAgY29uc3QgcGF0Y2hEaXIgPSBzbGFzaChub3JtYWxpemUoKGFyZ3ZbXCJwYXRjaC1kaXJcIl0gfHwgXCJwYXRjaGVzXCIpICsgc2VwKSlcbiAgaWYgKHBhdGNoRGlyLnN0YXJ0c1dpdGgoXCIvXCIpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiLS1wYXRjaC1kaXIgbXVzdCBiZSBhIHJlbGF0aXZlIHBhdGhcIilcbiAgfVxuICBpZiAocGFja2FnZU5hbWVzLmxlbmd0aCkge1xuICAgIGNvbnN0IGluY2x1ZGVQYXRocyA9IG1ha2VSZWdFeHAoXG4gICAgICBhcmd2LmluY2x1ZGUsXG4gICAgICBcImluY2x1ZGVcIixcbiAgICAgIC8uKi8sXG4gICAgICBhcmd2W1wiY2FzZS1zZW5zaXRpdmUtcGF0aC1maWx0ZXJpbmdcIl0sXG4gICAgKVxuICAgIGNvbnN0IGV4Y2x1ZGVQYXRocyA9IG1ha2VSZWdFeHAoXG4gICAgICBhcmd2LmV4Y2x1ZGUsXG4gICAgICBcImV4Y2x1ZGVcIixcbiAgICAgIC9wYWNrYWdlXFwuanNvbiQvLFxuICAgICAgYXJndltcImNhc2Utc2Vuc2l0aXZlLXBhdGgtZmlsdGVyaW5nXCJdLFxuICAgIClcbiAgICBjb25zdCBwYWNrYWdlTWFuYWdlciA9IGRldGVjdFBhY2thZ2VNYW5hZ2VyKFxuICAgICAgYXBwUGF0aCxcbiAgICAgIGFyZ3ZbXCJ1c2UteWFyblwiXSA/IFwieWFyblwiIDogbnVsbCxcbiAgICApXG4gICAgcGFja2FnZU5hbWVzLmZvckVhY2goKHBhY2thZ2VQYXRoU3BlY2lmaWVyOiBzdHJpbmcpID0+IHtcbiAgICAgIG1ha2VQYXRjaCh7XG4gICAgICAgIHBhY2thZ2VQYXRoU3BlY2lmaWVyLFxuICAgICAgICBhcHBQYXRoLFxuICAgICAgICBwYWNrYWdlTWFuYWdlcixcbiAgICAgICAgaW5jbHVkZVBhdGhzLFxuICAgICAgICBleGNsdWRlUGF0aHMsXG4gICAgICAgIHBhdGNoRGlyLFxuICAgICAgfSlcbiAgICB9KVxuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUubG9nKFwiQXBwbHlpbmcgcGF0Y2hlcy4uLlwiKVxuICAgIGNvbnN0IHJldmVyc2UgPSAhIWFyZ3ZbXCJyZXZlcnNlXCJdXG4gICAgYXBwbHlQYXRjaGVzRm9yQXBwKHsgYXBwUGF0aCwgcmV2ZXJzZSwgcGF0Y2hEaXIgfSlcbiAgfVxufVxuXG5mdW5jdGlvbiBwcmludEhlbHAoKSB7XG4gIGNvbnNvbGUubG9nKGBcblVzYWdlOlxuXG4gIDEuIFBhdGNoaW5nIHBhY2thZ2VzXG4gID09PT09PT09PT09PT09PT09PT09XG5cbiAgICAke2NoYWxrLmJvbGQoXCJwYXRjaC1wYWNrYWdlXCIpfVxuXG4gIFdpdGhvdXQgYXJndW1lbnRzLCB0aGUgJHtjaGFsay5ib2xkKFxuICAgIFwicGF0Y2gtcGFja2FnZVwiLFxuICApfSBjb21tYW5kIHdpbGwgYXR0ZW1wdCB0byBmaW5kIGFuZCBhcHBseVxuICBwYXRjaCBmaWxlcyB0byB5b3VyIHByb2plY3QuIEl0IGxvb2tzIGZvciBmaWxlcyBuYW1lZCBsaWtlXG5cbiAgICAgLi9wYXRjaGVzLzxwYWNrYWdlLW5hbWU+Kzx2ZXJzaW9uPi5wYXRjaFxuXG4gIDIuIENyZWF0aW5nIHBhdGNoIGZpbGVzXG4gID09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAke2NoYWxrLmJvbGQoXCJwYXRjaC1wYWNrYWdlXCIpfSA8cGFja2FnZS1uYW1lPiR7Y2hhbGsuaXRhbGljKFxuICAgIFwiWyA8cGFja2FnZS1uYW1lPl1cIixcbiAgKX1cblxuICBXaGVuIGdpdmVuIHBhY2thZ2UgbmFtZXMgYXMgYXJndW1lbnRzLCBwYXRjaC1wYWNrYWdlIHdpbGwgY3JlYXRlIHBhdGNoIGZpbGVzXG4gIGJhc2VkIG9uIGFueSBjaGFuZ2VzIHlvdSd2ZSBtYWRlIHRvIHRoZSB2ZXJzaW9ucyBpbnN0YWxsZWQgYnkgeWFybi9ucG0uXG5cbiAgT3B0aW9uczpcblxuICAgICAke2NoYWxrLmJvbGQoXCItLXVzZS15YXJuXCIpfVxuXG4gICAgICAgICBCeSBkZWZhdWx0LCBwYXRjaC1wYWNrYWdlIGNoZWNrcyB3aGV0aGVyIHlvdSB1c2UgbnBtIG9yIHlhcm4gYmFzZWQgb25cbiAgICAgICAgIHdoaWNoIGxvY2tmaWxlIHlvdSBoYXZlLiBJZiB5b3UgaGF2ZSBib3RoLCBpdCB1c2VzIG5wbSBieSBkZWZhdWx0LlxuICAgICAgICAgU2V0IHRoaXMgb3B0aW9uIHRvIG92ZXJyaWRlIHRoYXQgZGVmYXVsdCBhbmQgYWx3YXlzIHVzZSB5YXJuLlxuXG4gICAgICR7Y2hhbGsuYm9sZChcIi0tZXhjbHVkZSA8cmVnZXhwPlwiKX1cblxuICAgICAgICAgSWdub3JlIHBhdGhzIG1hdGNoaW5nIHRoZSByZWdleHAgd2hlbiBjcmVhdGluZyBwYXRjaCBmaWxlcy5cbiAgICAgICAgIFBhdGhzIGFyZSByZWxhdGl2ZSB0byB0aGUgcm9vdCBkaXIgb2YgdGhlIHBhY2thZ2UgdG8gYmUgcGF0Y2hlZC5cblxuICAgICAgICAgRGVmYXVsdDogJ3BhY2thZ2VcXFxcLmpzb24kJ1xuXG4gICAgICR7Y2hhbGsuYm9sZChcIi0taW5jbHVkZSA8cmVnZXhwPlwiKX1cblxuICAgICAgICAgT25seSBjb25zaWRlciBwYXRocyBtYXRjaGluZyB0aGUgcmVnZXhwIHdoZW4gY3JlYXRpbmcgcGF0Y2ggZmlsZXMuXG4gICAgICAgICBQYXRocyBhcmUgcmVsYXRpdmUgdG8gdGhlIHJvb3QgZGlyIG9mIHRoZSBwYWNrYWdlIHRvIGJlIHBhdGNoZWQuXG5cbiAgICAgICAgIERlZmF1bHQgJy4qJ1xuXG4gICAgICR7Y2hhbGsuYm9sZChcIi0tY2FzZS1zZW5zaXRpdmUtcGF0aC1maWx0ZXJpbmdcIil9XG5cbiAgICAgICAgIE1ha2UgcmVnZXhwcyB1c2VkIGluIC0taW5jbHVkZSBvciAtLWV4Y2x1ZGUgZmlsdGVycyBjYXNlLXNlbnNpdGl2ZS5cblxuICAgICAke2NoYWxrLmJvbGQoXCItLXBhdGNoLWRpclwiKX1cblxuICAgICAgICAgU3BlY2lmeSB0aGUgbmFtZSBmb3IgdGhlIGRpcmVjdG9yeSBpbiB3aGljaCB0byBwdXQgdGhlIHBhdGNoIGZpbGVzLlxuYClcbn1cbiJdfQ==