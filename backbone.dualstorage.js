(function() {
  'use strict';  var S4, dualsync, localsync, onlineSync, parseRemoteResponse, result;
  Backbone.Collection.prototype.syncDirty = function() {
    var id, ids, model, store, _i, _len, _results;
    store = localStorage.getItem("" + this.url + "_dirty");
    ids = (store && store.split(',')) || [];
    _results = [];
    for (_i = 0, _len = ids.length; _i < _len; _i++) {
      id = ids[_i];
      model = id.length === 36 ? this.where({
        id: id
      })[0] : this.get(parseInt(id));
      _results.push(model.save());
    }
    return _results;
  };
  Backbone.Collection.prototype.syncDestroyed = function() {
    var id, ids, model, store, _i, _len, _results;
    store = localStorage.getItem("" + this.url + "_destroyed");
    ids = (store && store.split(',')) || [];
    _results = [];
    for (_i = 0, _len = ids.length; _i < _len; _i++) {
      id = ids[_i];
      model = new this.model({
        id: id
      });
      model.collection = this;
      _results.push(model.destroy());
    }
    return _results;
  };
  Backbone.Collection.prototype.syncDirtyAndDestroyed = function() {
    this.syncDirty();
    return this.syncDestroyed();
  };
  S4 = function() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  window.Store = (function() {
    Store.prototype.sep = '';
    function Store(name) {
      this.name = name;
      this.records = this.recordsOn(this.name);
    }
    Store.prototype.generateId = function() {
      return S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4();
    };
    Store.prototype.save = function() {
      return this.localStorageSet(this.name, this.records.join(','));
    };
    Store.prototype.localStorageSet = function(itemName, itemValue) {
      try {
        return localStorage.setItem(itemName, itemValue);
      } catch (error) {

      }
    };
    Store.prototype.recordsOn = function(key) {
      var store;
      store = localStorage.getItem(key);
      return (store && store.split(',')) || [];
    };
    Store.prototype.dirty = function(model) {
      var dirtyRecords;
      dirtyRecords = this.recordsOn(this.name + '_dirty');
      if (!_.include(dirtyRecords, model.id.toString())) {
        dirtyRecords.push(model.id);
        this.localStorageSet(this.name + '_dirty', dirtyRecords.join(','));
      }
      return model;
    };
    Store.prototype.clean = function(model, from) {
      var dirtyRecords, store;
      store = "" + this.name + "_" + from;
      dirtyRecords = this.recordsOn(store);
      if (_.include(dirtyRecords, model.id.toString())) {
        this.localStorageSet(store, _.without(dirtyRecords, model.id.toString()).join(','));
      }
      return model;
    };
    Store.prototype.destroyed = function(model) {
      var destroyedRecords;
      destroyedRecords = this.recordsOn(this.name + '_destroyed');
      if (!_.include(destroyedRecords, model.id.toString())) {
        destroyedRecords.push(model.id);
        this.localStorageSet(this.name + '_destroyed', destroyedRecords.join(','));
      }
      return model;
    };
    Store.prototype.create = function(model) {
      if (!_.isObject(model)) {
        return model;
      }
      if (model.attributes != null) {
        model = model.attributes;
      }
      if (!model.id) {
        model.id = this.generateId();
      }
      this.localStorageSet(this.name + this.sep + model.id, JSON.stringify(model));
      this.records.push(model.id.toString());
      this.save();
      return model;
    };
    Store.prototype.update = function(model) {
      this.localStorageSet(this.name + this.sep + model.id, JSON.stringify(model));
      if (!_.include(this.records, model.id.toString())) {
        this.records.push(model.id.toString());
      }
      this.save();
      return model;
    };
    Store.prototype.clear = function() {
      var id, _i, _len, _ref;
      _ref = this.records;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        id = _ref[_i];
        localStorage.setItem(this.name + this.sep + id, null);
      }
      this.records = [];
      return this.save();
    };
    Store.prototype.hasDirtyOrDestroyed = function() {
      return !_.isEmpty(localStorage.getItem(this.name + '_dirty')) || !_.isEmpty(localStorage.getItem(this.name + '_destroyed'));
    };
    Store.prototype.find = function(model) {
      return JSON.parse(localStorage.getItem(this.name + this.sep + model.id));
    };
    Store.prototype.findAll = function() {
      var id, _i, _len, _ref, _results;
      _ref = this.records;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        id = _ref[_i];
        _results.push(JSON.parse(localStorage.getItem(this.name + this.sep + id)));
      }
      return _results;
    };
    Store.prototype.destroy = function(model) {
      localStorage.setItem(this.name + this.sep + model.id, null);
      this.records = _.reject(this.records, function(record_id) {
        return record_id === model.id.toString();
      });
      this.save();
      return model;
    };
    return Store;
  })();
  localsync = function(method, model, options) {
    var response, store;
    store = new Store(options.storeName);
    response = (function() {
      switch (method) {
        case 'read':
          if (model.id) {
            return store.find(model);
          } else {
            return store.findAll();
          }
          break;
        case 'hasDirtyOrDestroyed':
          return store.hasDirtyOrDestroyed();
        case 'clear':
          return store.clear();
        case 'create':
          model = store.create(model);
          if (options.dirty) {
            return store.dirty(model);
          }
          break;
        case 'update':
          store.update(model);
          if (options.dirty) {
            return store.dirty(model);
          } else {
            return store.clean(model, 'dirty');
          }
          break;
        case 'delete':
          store.destroy(model);
          if (options.dirty) {
            return store.destroyed(model);
          } else {
            if (model.id.toString().length === 36) {
              return store.clean(model, 'dirty');
            } else {
              return store.clean(model, 'destroyed');
            }
          }
      }
    })();
    if (!options.ignoreCallbacks) {
      if (response) {
        options.success(response);
      } else {
        options.error('Record not found');
      }
    }
    return response;
  };
  result = function(object, property) {
    var value;
    if (!object) {
      return null;
    }
    value = object[property];
    if (_.isFunction(value)) {
      return value.call(object);
    } else {
      return value;
    }
  };
  parseRemoteResponse = function(object, response) {
    if (!(object && object.parseBeforeLocalSave)) {
      return response;
    }
    if (_.isFunction(object.parseBeforeLocalSave)) {
      return object.parseBeforeLocalSave(response);
    }
  };
  onlineSync = Backbone.sync;
  dualsync = function(method, model, options) {
    var error, local, originalModel, remoteOptions, success;
    options.storeName = result(model.collection, 'url') || result(model, 'url');
    if (result(model, 'remote') || result(model.collection, 'remote')) {
      return onlineSync(method, model, options);
    }
    local = result(model, 'local') || result(model.collection, 'local');
    options.dirty = options.remote === false && !local;
    if (options.remote === false || local) {
      return localsync(method, model, options);
    }
    options.ignoreCallbacks = true;
    success = options.success;
    error = options.error;
    switch (method) {
      case 'read':
        if (localsync('hasDirtyOrDestroyed', model, options)) {
          return success(localsync(method, model, options));
        } else {
          remoteOptions = _(options).clone();
          remoteOptions.success = function(resp, status, xhr) {
            var i, _i, _len;
            resp = parseRemoteResponse(model, resp);
            localsync('clear', model, options);
            if (_.isArray(resp)) {
              for (_i = 0, _len = resp.length; _i < _len; _i++) {
                i = resp[_i];
                localsync('create', i, options);
              }
            } else {
              localsync('create', resp, options);
            }
            return success(resp, status, xhr);
          };
          options.ignoreCallbacks = false;
          options.success = function(resp) {
            success(resp);
            if (_.isUndefined(model.shouldRemoteSync) || (_.isFunction(model.shouldRemoteSync) && model.shouldRemoteSync())) {
              return onlineSync(method, model, remoteOptions);
            }
          };
          return localsync(method, model, options);
        }
        break;
      case 'create':
        options.success = function(resp, status, xhr) {
          localsync(method, resp, options);
          return success(resp, status, xhr);
        };
        options.error = function(resp) {
          options.dirty = true;
          return success(localsync(method, model, options));
        };
        return onlineSync(method, model, options);
      case 'update':
        if (_.isString(model.id) && model.id.length === 36) {
          originalModel = model.clone();
          options.success = function(resp, status, xhr) {
            localsync('delete', originalModel, options);
            localsync('create', resp, options);
            return success(resp, status, xhr);
          };
          options.error = function(resp) {
            options.dirty = true;
            return success(localsync(method, originalModel, options));
          };
          model.set({
            id: null
          });
          return onlineSync('create', model, options);
        } else {
          options.success = function(resp, status, xhr) {
            return success(localsync(method, model, options));
          };
          options.error = function(resp) {
            options.dirty = true;
            return success(localsync(method, model, options));
          };
          return onlineSync(method, model, options);
        }
        break;
      case 'delete':
        if (_.isString(model.id) && model.id.length === 36) {
          return localsync(method, model, options);
        } else {
          options.success = function(resp, status, xhr) {
            localsync(method, model, options);
            return success(resp, status, xhr);
          };
          options.error = function(resp) {
            options.dirty = true;
            return success(localsync(method, model, options));
          };
          return onlineSync(method, model, options);
        }
    }
  };
  Backbone.sync = dualsync;
}).call(this);
