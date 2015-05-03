'use strict';

import $ from 'jquery';
import toml from 'toml';
import _ from 'lodash';
import Passage from './passage';
import Helpers from './helpers';

class Story {
  constructor(element) {
    this.element = element;
    this.name = element.attr('name');
    this.startPassageID = parseInt(element.attr('startnode'));
    this.IFID = element.attr('ifid');
    this.creator = element.attr('creator');
    this.creatorVersion = element.attr('creator-version');

    this.history = [];
    this.state = {};
    this.currentCheckpoint = '';
    this.atCheckpoint = true;

    this.config = {
      darkTheme: false
    };

    this._findPassages();
    this._displayStyles();
    this._executeScripts();
    this._getMetaPassages();
    this._setupEvents();
    this._useConfig();
  }

  play() {
		if (localStorage.getItem(this.saveKey) == undefined || !this.restore()) {
			this.goToPassage(this.startPassageID);
      this.atCheckpoint = true;
		}
  }

  getPassage(query) {
		if (_.isNumber(query)) {
			return this.passages[query];
    }
		else if (_.isString(query)) {
			return _.findWhere(this.passages, { name: query });
    }
  }

  goToPassage(query, addToHistory = true) {
    $.event.trigger('goToPassage:before');

		var passage = this.getPassage(query);

		if (!passage) {
			throw new Error(`No passage found with ID or name "${query}"`);
    }

    if (addToHistory) {
  		this.history.push(passage.id);
    }

    if (_.includes(passage.tags, 'checkpoint')) {
      this.checkpoint(passage.name);
    }

		if (this.atCheckpoint) {
			window.history.pushState({ state: this.state, history: this.history, checkpointName: this.checkpointName }, '', '');
    }
		else {
			window.history.replaceState({ state: this.state, history: this.history, checkpointName: this.checkpointName }, '', '');
    }

		this.atCheckpoint = false;

    $('#passage').html(passage.render());
    if (this.header) {
      $('#header .inside').html(this.header.render());
    }
    if (this.footer) {
      $('#footer .inside').html(this.footer.render());
    }

    $.event.trigger('goToPassage:after');
  }

  showPassage(query) {
		var passage = this.getPassage(query);

		if (!passage) {
			throw new Error(`No passage found with ID or name "${query}"`);
    }

    $.event.trigger('showPassage:before');
    return passage.render();
    $.event.trigger('showPassage:after');
  }

  checkpoint(name) {
		$.event.trigger('checkpoint:before');
    document.title = `${this.name}: ${name}`
    this.currentCheckpoint = name;
		this.atCheckpoint = true;
		$.event.trigger('checkpoint:after');
  }

  save() {
		$.event.trigger('save:before');
    localStorage.setItem(this.saveKey, this.serialized)
		$.event.trigger('save:after');
  }

  get serialized() {
    return JSON.stringify({
      state: this.state,
      history: this.history,
      currentCheckpoint: this.currentCheckpoint
    });
  }

  get saveKey() {
    return `${this.name.toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-')}.save`;
  }

  get saveData() {
    var data;
    if (data = localStorage.getItem(this.saveKey)) {
      return JSON.parse(data);
    }
    else {
      return null;
    }
  }

  restore() {
		$.event.trigger('restore:before');

		try {
      var save = this.saveData;
			this.state = save.state;
			this.history = save.history;
			this.currentCheckpoint = save.currentCheckpoint;
			this.goToPassage(this.history[this.history.length - 1]);
		}
		catch (e) {
			$.event.trigger('restore:failed');
			return false;
		};

		$.event.trigger('restore:after');
		return true;
  }

  reset() {
    $.event.trigger('reset:before');
    localStorage.removeItem(this.saveKey);
    $.event.trigger('reset:after');
  }

  get previousPassage() {
    if (this.history.length <= 1) {
      return null;
    }

    var previous;
    if (previous = this.history[this.history.length - 1]) {
      return previous;
    }
  }

  get nextPassage() {
    if (this.history.length <= 1) {
      return null;
    }

    var next;
    if (next = this.history[this.history.length]) {
      return next;
    }
  }

  get helpers() {
    if (!this._helpers) {
      var helpers = new Helpers(this);
      this._helpers = helpers.all;
    }

    return this._helpers;
  }

  _findPassages() {
    console.log('Parsing passage data...');

    this.passages = [];
    _.each(this.element.children('tw-passagedata'), (passageElement) => {
      passageElement = $(passageElement);
      this.passages[passageElement.attr('pid')] = new Passage({
        story: this,
        element: passageElement
      });
    });
  }

  _displayStyles() {
    console.log('Displaying story styles...');

    _.each(this.element.children('#twine-user-stylesheet'), (style) => {
      $('body').append('<style>' + $(style).html() + '</style>');
    });
  }

  _executeScripts() {
    console.log('Executing story scripts...');

    _.each(this.element.children('#twine-user-script'), (script) => {
      eval($(script).html());
    });
  }

  _setupEvents() {
    console.log('Setting up events...');

  	$(window).on('popstate', (event) => {
  		var state = event.originalEvent.state;

  		if (state) {
  			this.state = state.state;
  			this.history = state.history;
  			this.currentCheckpoint = state.currentCheckpoint;
  			this.goToPassage(this.history[this.history.length - 1]);
  		}
  		else if (this.history.length < 1) {
  			this.state = {};
  			this.history = [];
  			this.currentCheckpoint = '';
  			this.goToPassage(this.startPassageID);
  		};
  	});

    $('body').on('click', 'a[data-passage]', (event) => {
      var link = $(event.target);
      if (link.attr('data-show')) {
        var passage = this.showPassage(link.attr('data-passage'));
        link.replaceWith(passage || '');
      }
      else {
    		this.goToPassage(link.attr('data-passage'), link.attr('history') || true);
      }
  	});

    $('body').on('click', '.save-link', (event) => {
      this.save();
    });

    $('body').on('click', '.restore-link', (event) => {
      this.restore();
    });

  	window.onerror = function (message, url, line) {
      console.error(message, url, line);
  	};
  }

  _getMetaPassages() {
    console.log('Looking for meta passages...');

    this.header = this.getPassage('HEADER');
    this.footer = this.getPassage('FOOTER');
    var configPassage = this.getPassage('CONFIG');

    if (this.header) {
      $('#header').removeClass('hidden');
    }
    if (this.footer) {
      $('#footer').removeClass('hidden');
    }

    if (configPassage) {
      this.config = _.defaults(toml.parse(configPassage.source), this.config);
    }
  }

  _useConfig() {
    console.log('Parsing config...');

    if (this.config.darkTheme) {
      $('body').addClass('dark');
    }

    if (this.config.stylesheets) {
      _.each(this.config.stylesheets, (url) => {
        $('head').append(
          `<link href='${url}' rel='stylesheet' type='text/css'>`
        );
      })
    }
  }
}

export default Story;