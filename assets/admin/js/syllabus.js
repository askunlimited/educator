(function($) {
	'use strict';

	/**
	 * Add lessons collection to the register.
	 *
	 * @param {Object} lessons
	 */
	function addLessonCollection(lessons) {
		lessonCollections.push(lessons);
	}

	/**
	 * Remove lessons collection from the register.
	 *
	 * @param {Object} lessons
	 */
	function removeLessonCollection(lessons) {
		for (var i = 0; i < lessonCollections.length; ++i) {
			if (lessonCollections[i] === lessons) {
				lessonCollections.splice(i, 1);
				break;
			}
		}
	}

	/**
	 * Check if a given lesson exists in the register.
	 *
	 * @param {number} lessonId
	 */
	function lessonExists(lessonId) {
		var i, lessonExists;

		for (i = 0; i < lessonCollections.length; ++i) {
			lessonExists = false;

			_.each(lessonCollections[i].models, function(lesson) {
				if (lesson.get('post_id') === lessonId) {
					lessonExists = true;
					return false;
				}
			});

			if (lessonExists) {
				return true;
			}
		}

		return false;
	}

	/**
	 * @type {Array.<Lessons>}
	 */
	var lessonCollections = [];

	/**
	 * @type {number}
	 */
	var uniqueGroupId = 1;

	/**
	 * Lesson Model.
	 */
	var Lesson = Backbone.Model.extend({
		defaults: {
			post_id: null,
			group_id: null,
			title: '',
			view_link: '',
			edit_link: ''
		}
	});

	/**
	 * Lessons Collection.
	 */
	var Lessons = Backbone.Collection.extend({
		model: Lesson
	});

	/**
	 * Lesson View.
	 */
	var LessonView = Backbone.View.extend({
		tagName: 'li',
		className: 'lesson',
		template: _.template($('#edr-syllabus-lesson-view').html()),

		/**
		 * @type {Object.<string, string>}
		 */
		events: {
			'click .remove-lesson': 'removeLesson'
		},

		/**
		 * Initialize.
		 */
		initialize: function() {
			this.listenTo(this.model, 'destroy', this.remove);
		},

		/**
		 * Render.
		 */
		render: function() {
			this.$el.html(this.template(this.model.toJSON()));

			return this;
		},

		/**
		 * Process "remove lesson" event.
		 */
		removeLesson: function(e) {
			this.model.destroy();
			e.preventDefault();
		}
	});

	/**
	 * Group Model.
	 */
	var Group = Backbone.Model.extend({
		defaults: {
			group_id: 0,
			title: ''
		}
	});

	/**
	 * Groups Collection.
	 */
	var Groups = Backbone.Collection.extend({
		model: Group
	});

	/**
	 * Group View.
	 */
	var GroupView = Backbone.View.extend({
		tagName: 'li',
		template: _.template($('#edr-syllabus-group-view').html()),

		/**
		 * @type {Object.<string, string>}
		 */
		events: {
			'edr.select.add': 'addLesson',
			'click .remove-group': 'removeGroup'
		},

		/**
		 * @type {(Object|null)}
		 */
		lessons: null,

		/**
		 * Initialize.
		 */
		initialize: function(options) {
			var i;

			this.lessons = new Lessons();

			if (options.lessons) {
				this.lessons.add(options.lessons);
			}

			this.listenTo(this.lessons, 'add', this.renderLesson);
			this.listenTo(this.model, 'destroy', this.remove);

			addLessonCollection(this.lessons);
		},

		/**
		 * Render.
		 *
		 * @return {Object} this
		 */
		render: function() {
			var that = this;

			this.$el.html(this.template(this.model.toJSON()));

			this.selectLessons = EdrLib.select(this.$el.find('input.select-lessons:first').get(0), {
				key: 'id',
				label: 'title',
				searchBy: 'title',
				url: ajaxurl,
				ajaxArgs: {
					action: 'edr_syllabus_select_lessons',
					current_course_id: $('input#post_ID').val(),
					_wpnonce: edrSyllabusText.selectLessonsNonce
				},
				allowNewValues: true
			});

			this.$el.find('ul.lessons').sortable({
				handle: '.handle',
				axis: 'y',
				placeholder: 'edr-placeholder',
				forcePlaceholderSize: true,
				start: function(e, ui) {
					ui.item.data('edr-index', ui.item.index());
				},
				update: function(e, ui) {
					// Update the lesson's index in the collection.
					var comparator = that.lessons.comparator;
					var model = that.lessons.at(ui.item.data('edr-index'));

					delete that.lessons.comparator;
					that.lessons.remove(model, {silent: true});
					that.lessons.add(model, {silent: true, at: ui.item.index()});
					that.lessons.comparator = comparator;
					that.lessons.trigger('reset', that.lessons);
				}
			});

			if (this.lessons.length) {
				_.each(this.lessons.models, function(lessonModel) {
					that.lessons.trigger('add', lessonModel);
				});
			}

			return this;
		},

		/**
		 * Render a lesson.
		 *
		 * @param {Object} lessonModel
		 */
		renderLesson: function(lessonModel) {
			var lessonView = new LessonView({
				model: lessonModel
			});

			this.$el.find('ul.lessons').append(lessonView.render().$el);
		},

		/**
		 * Create lesson.
		 *
		 * @param {object} lesson
		 */
		createLesson: function(lesson) {
			var that = this;

			this.selectLessons.disable();

			$.ajax({
				method: 'post',
				url: ajaxurl,
				dataType: 'json',
				data: {
					_wpnonce: edrSyllabusText.addLessonNonce,
					action: 'edr_syllabus_add_lesson',
					title: lesson.title,
					course_id: $('#post_ID').val()
				},
				success: function(response) {
					var lesson;

					if (response.status === 'success') {
						lesson = response.lesson;
						lesson.group_id = that.model.get('group_id');
						that.lessons.add(lesson);
						that.selectLessons.clearItems();
						that.selectLessons.enable();
					}
				},
				error: function() {
					that.selectLessons.enable();
				}
			});
		},

		/**
		 * Add a lesson to the collection and render it.
		 *
		 * @param {object} e Event object.
		 * @param {object} data
		 */
		addLesson: function(e, data) {
			var lesson = data.item;

			e.preventDefault();

			if (data.isNew) {
				this.createLesson(lesson);
			} else {
				if (!lesson.id || lessonExists(lesson.id)) {
					return;
				}

				this.lessons.add({
					post_id: lesson.id,
					title: lesson.title,
					group_id: this.model.get('group_id'),
					view_link: lesson.view_link,
					edit_link: lesson.edit_link
				});
			}
		},

		/**
		 * Remove group.
		 *
		 * @param {Object} e Event object.
		 */
		removeGroup: function(e) {
			e.preventDefault();

			this.model.destroy();
		},

		addNewLesson: function(e, item) {
			var that = this;

		},

		/**
		 * Remove this view.
		 */
		remove: function() {
			_.each(this.lessons.models, function(lessonModel) {
				lessonModel.trigger('destroy');
			});

			removeLessonCollection(this.lessons);

			this.selectLessons.destroy();
			this.$el.find('ul.lessons').sortable('destroy');
			
			Backbone.View.prototype.remove.apply(this, arguments);
		}
	});

	/**
	 * App View.
	 */
	var AppView = Backbone.View.extend({
		/**
		 * @type {string}
		 */
		el: '#edr-syllabus',

		/**
		 * @type {Object.<string, string>}
		 */
		events: {
			'click .add-group': 'addGroup'
		},

		/**
		 * @type {boolean}
		 */
		loading: true,

		/**
		 * Initialize.
		 */
		initialize: function() {
			var that = this;
			var groupModel = null;
			var groupView = null;
			var groupViewAttrs = null;
			var groupsHTML = null;

			this.groups = new Groups();

			this.listenTo(this.groups, 'add', this.renderGroup);

			// Populate with initial data.
			if (typeof edrSyllabus === 'object') {
				groupsHTML = document.createDocumentFragment();

				for (var i = 0; i < edrSyllabus.length; ++i) {
					groupModel = this.groups.add({
						group_id: uniqueGroupId++,
						title: edrSyllabus[i].title
					}, {
						silent: true
					});

					groupViewAttrs = {};
					groupViewAttrs.model = groupModel;

					if (edrSyllabus[i].lessons) {
						for (var j = 0; j < edrSyllabus[i].lessons.length; ++j) {
							edrSyllabus[i].lessons[j].group_id = groupModel.get('group_id');
						}

						groupViewAttrs.lessons = edrSyllabus[i].lessons;
					}

					groupView = new GroupView(groupViewAttrs);

					groupsHTML.appendChild(groupView.render().el);
				}

				this.$el.find('> .groups').append(groupsHTML);
			}

			// Make groups sortable.
			this.$el.find('> .groups').sortable({
				axis: 'y',
				handle: '.handle',
				forcePlaceholderSize: true,
				placeholder: 'edr-placeholder',
				start: function(e, ui) {
					ui.item.data('edr-index', ui.item.index());
				},
				update: function(e, ui) {
					// Update the group's index in the collection.
					var comparator = that.groups.comparator;
					var model = that.groups.at(ui.item.data('edr-index'));

					delete that.groups.comparator;
					that.groups.remove(model, {silent: true});
					that.groups.add(model, {silent: true, at: ui.item.index()});
					that.groups.comparator = comparator;
					that.groups.trigger('reset', that.groups);
				}
			});

			// The syllabus manager is ready at this point.
			this.loading = false;
			this.$el.find('input[name="edr_syllabus_status"]').val('ready');
			this.$el.find('div.edr-loading').hide();
		},

		/**
		 * Render a group.
		 *
		 * @param {Object} groupModel
		 */
		renderGroup: function(groupModel) {
			var groupView = new GroupView({
				model: groupModel
			});

			this.$el.find('> .groups').append(groupView.render().$el);
		},

		/**
		 * Add a group to the collection and render it.
		 *
		 * @param {Object} e Event object.
		 */
		addGroup: function(e) {
			e.preventDefault();

			if (this.loading) {
				return;
			}

			this.groups.add({
				group_id: uniqueGroupId++,
				title: ''
			});
		}
	});

	var av = new AppView();

})(jQuery);
