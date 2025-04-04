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
  "./LineAbstract",
  "pentaho/i18n!./i18n/model"
], function (module, BaseModel, bundle) {

  "use strict";

  return BaseModel.extend({
    $type: {
      id: module.id
    }
  })
  .localize({$type: bundle.structured.LineStacked})
  .configure();
});
