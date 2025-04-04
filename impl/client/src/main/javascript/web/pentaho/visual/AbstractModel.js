/*! ******************************************************************************
 *
 * Pentaho
 *
 * Copyright (C) 2024 by Hitachi Vantara, LLC : http://www.pentaho.com
 *
 * Use of this software is governed by the Business Source License included
 * in the LICENSE.TXT file.
 *
 * Change Date: 2029-07-20
 ******************************************************************************/

define([
  "pentaho/module!_",
  "pentaho/type/Complex",
  "./role/AbstractProperty",
  "./color/PaletteProperty", // Also pre-loads all registered palette instances.
  "./Application",
  "./KeyTypes",
  "pentaho/data/filter/Abstract",
  "pentaho/type/Object",
  "pentaho/util/object",
  "pentaho/type/action/ComplexChangeset",
  "pentaho/i18n!model",
  // Pre-load all registered filter types.
  "pentaho/module/subtypesOf!pentaho/data/filter/Abstract"
], function(module, Complex, RoleAbstractProperty, PaletteProperty, VisualApplication, VisualKeyTypes,
            AbstractFilter, PentahoObject, O, ComplexChangeset, bundle) {

  "use strict";

  // NOTE: Doing it this way, `change:finally` phase listeners cannot observe invalid cached information.
  /**
   * @classDesc Manages the lifetime of the cached information of the mapping instances associated with a
   * target abstract model.
   * @memberOf pentaho.visual
   * @class
   * @extends pentaho.type.action.ComplexChangeset
   * @private
   */
  var AbstractModelChangeset = ComplexChangeset.extend({

    /** @inheritDoc */
    _apply: function(model) {

      this.base(model);

      if(this.__areDataOrMappingsChanged(model.$type)) {
        model._onDataOrMappingsChanged();
      }
    },

    /**
     * Determines if the changeset contains data and/or visual role mapping.
     *
     * The implementation determines if the changeset
     * contains the `data` property or any other visual role property.
     *
     * @param {pentaho.visual.AbstractModelType} modelType - The target abstract model type.
     *
     * @return {boolean} `true`, if it contains; `false`, if not.
     *
     * @private
     */
    __areDataOrMappingsChanged: function(modelType) {

      var propNames = this.propertyNames;
      var i = -1;
      var P = propNames.length;
      while(++i < P) {
        var propName = propNames[i];
        if(propName === "data") {
          return true;
        }

        if(modelType.isVisualRole(modelType.get(propName))) {
          return true;
        }
      }

      return false;
    }
  });

  var _roleAbstractPropertyType = RoleAbstractProperty.type;
  var _palettePropertyType = PaletteProperty.type;

  /**
   * @name pentaho.visual.AbstractModelType
   * @class
   * @extends pentaho.type.ComplexType
   *
   * @classDesc The type class of {@link pentaho.visual.AbstractModel}.
   */

  /**
   * @name AbstractModel
   * @memberOf pentaho.visual
   * @class
   * @extends pentaho.type.Complex
   * @abstract
   *
   * @amd pentaho/visual/AbstractModel
   *
   * @classDesc The `AbstractModel` class is the abstract base class of visualization models.
   *
   * @constructor
   * @description Creates an `AbstractModel` instance.
   * @param {pentaho.visual.spec.IAbstractModel} [modelSpec] A plain object containing the abstract model
   * specification.
   */
  var AbstractModel = Complex.extend(/** @lends pentaho.visual.AbstractModel# */{

    /** @inheritDoc */
    _createChangeset: function(txn) {
      return new AbstractModelChangeset(txn, this);
    },

    /**
     * Called when the data property or any of the visual role properties has changed,
     * but before notifying any `change:finally` phase listeners of a change action.
     *
     * The default implementation calls the
     * [_onDataOrMappingChanged]{@link pentaho.visual.role.AbstractMapping#_onDataOrMappingChanged}
     * method of child visual role mappings.
     *
     * @protected
     */
    _onDataOrMappingsChanged: function() {
      this.$type.eachVisualRole(function(propType) {
        this.get(propType)._onDataOrMappingChanged();
      }, this);
    },

    /**
     * Gets an array of the names of fields which are mapped to _effective key_ visual roles.
     *
     * @type {Array.<string>}
     * @readOnly
     *
     * @see pentaho.visual.role.AbstractPropertyType#isVisualKeyEffective
     */
    get keyFieldNames() {

      var keyFields = [];
      var keyFieldSet = keyFields.set = Object.create(null);

      var modelType = this.$type;

      if(modelType.visualKeyType === VisualKeyTypes.dataKey) {
        modelType.eachVisualRole(function(propType) {
          if(propType.isVisualKey) {
            this.get(propType).fields.each(function(field) {
              var name = field.name;
              if(!O.hasOwn(keyFieldSet, name)) {
                keyFieldSet[name] = true;
                keyFields.push(name);
              }
            });
          }
        }, this);
      }

      return keyFields;
    },

    /**
     * Gets an array of the names of fields which are mapped to _effective measure_ visual roles
     * and which are not mapped to any _effective key_ visual roles.
     *
     * @type {Array.<string>}
     * @readOnly
     * @see pentaho.visual.role.AbstractPropertyType#isVisualKeyEffective
     */
    get measureFieldNames() {

      var keyFieldSet = this.keyFieldNames.set;

      var measureFields = [];
      var measureFieldSet = measureFields.set = Object.create(null);

      var modelType = this.$type;

      if(modelType.visualKeyType === VisualKeyTypes.dataKey) {
        modelType.eachVisualRole(function(propType) {
          if(!propType.isVisualKey) {
            this.get(propType).fields.each(function(field) {
              var name = field.name;
              if(!O.hasOwn(keyFieldSet, name) && !O.hasOwn(measureFieldSet, name)) {
                measureFieldSet[name] = true;
                measureFields.push(name);
              }
            });
          }
        }, this);
      }

      return measureFields;
    },

    // region serialization
    /** @inheritDoc */
    toSpecInContext: function(keyArgs) {

      if(keyArgs && keyArgs.isJson) {
        keyArgs = Object.create(keyArgs);

        var omitProps = keyArgs.omitProps;
        keyArgs.omitProps = omitProps = omitProps ? Object.create(omitProps) : {};

        // Only isJson serialization does not work with the value of `data`
        // due to the circular dependencies it contains.
        if(omitProps.data == null) omitProps.data = true;

        if(omitProps.selectionFilter == null) omitProps.selectionFilter = true;

        if(omitProps.application == null) omitProps.application = true;
      }

      return this.base(keyArgs);
    },
    // endregion

    $type: /** @lends pentaho.visual.AbstractModelType# */{

      id: module.id,
      isAbstract: true,

      props: [
        // TODO: Viz or Model?
        /**
         * Gets or sets the visual application object.
         *
         * The application object represents the relevant state and
         * interface of the application in which a model is being used.
         *
         * By default, this property is not included when serializing to JSON.
         * To serialize it, specify the argument `keyArgs.omitProps.application` of
         * [toSpec]{@link pentaho.visual.AbstractModel#toSpec} to `false`.
         *
         * @name application
         * @memberOf pentaho.visual.AbstractModel#
         * @type {pentaho.visual.Application}
         */
        {
          name: "application",
          valueType: VisualApplication
        },

        /**
         * Gets or sets the data of the visualization.
         *
         * By default, this property is not included when serializing to JSON.
         * To serialize it, specify the argument `keyArgs.omitProps.data` of
         * [toSpec]{@link pentaho.visual.AbstractModel#toSpec} to `false`.
         *
         * @name data
         * @memberOf pentaho.visual.AbstractModel#
         * @type {pentaho.data.ITable}
         */
        {
          name: "data",
          valueType: "object",
          isRequired: true,

          // @override
          toValueOn: function(defaultValueOwner, valueSpec) {

            var simpleTable = this.base(defaultValueOwner, valueSpec);
            if(simpleTable !== null) {
              var table = simpleTable.value.toPlainTable();

              // Wrap as simple again.
              return new PentahoObject(table);
            }

            return simpleTable;
          }
        },

        // TODO: Currently, the type system provides no easy way to normalize a set value,
        // without defining a subtype. Ideally, we'd use some "cast" hook provided
        // by property types. Because of this, the conversion to DNF (or simply calling toDnf() to make sure
        // non-termination is caught early) is not being ensured when the property is set but only on
        // the Select action's _doDefault.
        /**
         * Gets or sets the current data selection filter.
         *
         * This property is required.
         *
         * By default, this property is not included when serializing to JSON.
         * To serialize it, specify the argument `keyArgs.omitProps.selectionFilter` of
         * [toSpec]{@link pentaho.visual.AbstractModel#toSpec} to `false`.
         *
         * When set to a filter specification, {@link pentaho.data.filter.spec.IAbstract},
         * it is converted into a filter object.
         * Any standard filter can be safely loaded synchronously.
         *
         * **ATTENTION**: The current implementation only supports filters that can be
         * converted to [DNF]{@link pentaho.data.filter.Abstract#toDnf} _in a reasonable amount of time_.
         *
         * @name selectionFilter
         * @memberOf pentaho.visual.AbstractModel#
         * @type {pentaho.data.filter.Abstract}
         */
        {
          name: "selectionFilter",
          valueType: AbstractFilter,

          // Can be a shared instance - filters are immutable.
          defaultValue: {_: "or"},
          isRequired: true
        }
      ],

      /**
       * Calls a function for each defined visual role property type.
       *
       * A visual role property type is a property type which is a subtype of
       * {@link pentaho.visual.role.AbstractProperty}.
       *
       * @param {function(pentaho.type.PropertyType, number, pentaho.type.Complex) : boolean?} f - The mapping
       * function. Return `false` to break iteration.
       *
       * @param {?object} [x] The JS context object on which `f` is called.
       *
       * @return {pentaho.visual.Model} This object.
       */
      eachVisualRole: function(f, x) {
        var j = 0;
        this.each(function(propType) {
          if(this.isVisualRole(propType) && f.call(x, propType, j++, this) === false) {
            return false;
          }
        }, this);
        return this;
      },

      /**
       * Gets a value that indicates if a given property type is a subtype of
       * {@link pentaho.visual.role.AbstractPropertyType}.
       *
       * @param {pentaho.type.PropertyType} propType - The property type to test.
       * @return {boolean} `true` if `type` is a visual role property type; or `false`, otherwise.
       */
      isVisualRole: function(propType) {
        return propType.isSubtypeOf(_roleAbstractPropertyType);
      },

      /**
       * Gets a value that indicates if a given property type is a subtype of
       * {@link pentaho.visual.color.PalettePropertyType}.
       *
       * @param {pentaho.type.PropertyType} propType - The property type to test.
       * @return {boolean} `true` if `type` is a color palette property type; or `false`, otherwise.
       */
      isColorPalette: function(propType) {
        return propType.isSubtypeOf(_palettePropertyType);
      }

      /**
       * Gets the type of visual key used by the visualization.
       *
       * Abstract model classes may have a value of `undefined`.
       * However, once this property is specified to a non-undefined value, it cannot be changed anymore,
       * either in this class or in any of its subclasses.
       *
       * The default value, for a non-abstract class, is [dataKey]{@link }pentaho.visual.KeyTypes.dataKey}.
       *
       * @name visualKeyType
       * @memberOf pentaho.visual.AbstractModelType#
       * @type {pentaho.visual.KeyTypes|undefined}
       * @readOnly
       * @abstract
       *
       * @see pentaho.visual.role.AbstractPropertyType#isVisualKey
       * @see pentaho.visual.role.AbstractPropertyType#isVisualKeyEffective
       */
    }
  })
  .localize({$type: bundle.structured.AbstractModel})
  .configure();

  return AbstractModel;
});
