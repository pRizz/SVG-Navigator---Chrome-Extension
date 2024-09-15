//
// Copyright (c) 2011 Frank Kohlhepp
// https://github.com/frankkohlhepp/store-js
// License: MIT-license
//
(function () {
    var Store = this.Store = function (defaults) {
        if (defaults == undefined) {
            return;
        }
        
        for (let [key, defaultValue] of Object.entries(defaults)) {
            this.get(key, (result) => {
                if (result === undefined) {
                    this.set(key, defaultValue);
                }
            });
        }
        
    };

    Store.prototype.get = function (key, callback) {
        chrome.storage.sync.get(key, function (result) {
            if (chrome.runtime.lastError) {
                callback(null);
            } else {
                callback(result[key]);
            }
        });
    };

    Store.prototype.set = function (key, value) {
        var obj = {};
        obj[key] = value;
        chrome.storage.sync.set(obj, function () {
            if (chrome.runtime.lastError) {
                // Handle error
                // callback(false);
            } else {
                // callback(true);
            }
        });
    };

    Store.prototype.remove = function (name) {
        chrome.storage.sync.remove(name, function () {
            if (chrome.runtime.lastError) {
                // Handle error
                // callback(false);
            } else {
                // callback(true);
            }
        });
    };
}());
