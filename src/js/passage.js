'use strict';

import marked from 'marked';
import _ from 'lodash';
import $ from 'jquery';

class Passage {
  constructor(options) {
    this.story = options.story;
    this.element = options.element;
    this.id = parseInt(this.element.attr('pid'));
    this.name = this.element.attr('name');
    this.tags = this.element.attr('tags').split(' ');
    this.source = _.unescape(this.element.html());
  }

  render() {
    var data = _.defaults({
      passage: this,
      story: this.story
    }, this.story.helpers);

    var template = _.template(_.unescape(this.source));
    var parsed = this._processLinks(template(data));

    return marked(parsed);
  }

  _processLinks(text) {
		text = text.replace(/\[\[(.*?)\]\]/g, function (match, target) {
			var display = target;

      // Check for [[Text|Destination]]
			var barIndex = target.indexOf('|');

			if (barIndex != -1) {
				display = target.substr(0, barIndex);
				target = target.substr(barIndex + 1);
			}
			else {
        // Check for [[Text->Destination]]
				var rightArrIndex = target.indexOf('->');

				if (rightArrIndex != -1)
				{
					display = target.substr(0, rightArrIndex);
					target = target.substr(rightArrIndex + 2);
				}
			};

			if (/^\w+:\/\/\/?\w/i.test(target)) {
				return `<a href="${target}" class="external-link">${display}</a>`;
      }
			else {
				return `<a href="javascript:void(0)" data-passage="${target}" class="passage-link">${display}</a>`;
      }
		});

    return text;
  }
}

export default Passage;