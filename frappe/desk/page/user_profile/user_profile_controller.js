import BaseTimeline from "../../../public/js/frappe/form/footer/base_timeline";
frappe.provide('frappe.energy_points');

class UserProfile {
	constructor(wrapper) {
		this.wrapper = $(wrapper);
		this.page = wrapper.page;
		this.sidebar = this.wrapper.find('.layout-side-section');
		this.main_section = this.wrapper.find('.layout-main-section');
	}

	show() {
		let route = frappe.get_route();
		this.user_id = route[1] || frappe.session.user;

		//validate if user
		if (route.length > 1) {
			frappe.db.exists('User', this.user_id).then(exists => {
				if (exists) {
					this.make_user_profile();
				} else {
					frappe.msgprint(__('User does not exist'));
				}
			});
		} else {
			frappe.set_route('user-profile', frappe.session.user);
		}
	}

	make_user_profile() {
		this.user = frappe.user_info(this.user_id);
		this.page.set_title(this.user.fullname);
		this.setup_user_search();
		this.main_section.empty().append(frappe.render_template('user_profile'));
		this.energy_points = 0;
		this.review_points = 0;
		this.rank = 0;
		this.month_rank = 0;
		this.render_user_details();
		this.render_points_and_rank();
		this.render_heatmap();
		this.render_line_chart();
		this.render_percentage_chart('type', 'Type Distribution');
		this.create_percentage_chart_filters();
		this.setup_show_more_activity();
		this.render_user_activity();
	}

	setup_user_search() {
		this.$user_search_button = this.page.set_secondary_action(
			__('Change User'),
			() => this.show_user_search_dialog(),
			{ icon: 'change', size: 'sm' }
		);
	}

	show_user_search_dialog() {
		let dialog = new frappe.ui.Dialog({
			title: __('Change User'),
			fields: [
				{
					fieldtype: 'Link',
					fieldname: 'user',
					options: 'User',
					label: __('User'),
				}
			],
			primary_action_label: __('Go'),
			primary_action: ({ user }) => {
				dialog.hide();
				this.user_id = user;
				this.make_user_profile();
			}
		});
		dialog.show();
	}

	render_heatmap() {
		this.heatmap = new frappe.Chart('.performance-heatmap', {
			type: 'heatmap',
			countLabel: 'Energy Points',
			data: {},
			discreteDomains: 1,
			height: 150
		});
		this.update_heatmap_data();
		this.create_heatmap_chart_filters();
	}

	update_heatmap_data(date_from) {
		frappe.xcall('frappe.desk.page.user_profile.user_profile.get_energy_points_heatmap_data', {
			user: this.user_id,
			date: date_from || frappe.datetime.year_start(),
		}).then((r) => {
			this.heatmap.update({ dataPoints: r });
		});
	}


	render_line_chart() {
		this.line_chart_filters = [
			['Energy Point Log', 'user', '=', this.user_id, false],
			['Energy Point Log', 'type', '!=', 'Review', false]
		];

		this.line_chart_config = {
			timespan: 'Last Month',
			time_interval: 'Daily',
			type: 'Line',
			value_based_on: 'points',
			chart_type: 'Sum',
			document_type: 'Energy Point Log',
			name: 'Energy Points',
			width: 'half',
			based_on: 'creation'
		};

		this.line_chart = new frappe.Chart('.performance-line-chart', {
			type: 'line',
			height: 200,
			data: {
				labels: [],
				datasets: [{}]
			},
			colors: ['purple'],
			axisOptions: {
				xIsSeries: 1
			}
		});
		this.update_line_chart_data();
		this.create_line_chart_filters();
	}

	update_line_chart_data() {
		this.line_chart_config.filters_json = JSON.stringify(this.line_chart_filters);

		frappe.xcall('frappe.desk.doctype.dashboard_chart.dashboard_chart.get', {
			chart: this.line_chart_config,
			no_cache: 1,
		}).then(chart => {
			this.line_chart.update(chart);
		});
	}

	render_percentage_chart(field, title) {
		frappe.xcall('frappe.desk.page.user_profile.user_profile.get_energy_points_percentage_chart_data', {
			user: this.user_id,
			field: field
		}).then(chart => {
			if (chart.labels.length) {
				this.percentage_chart = new frappe.Chart('.performance-percentage-chart', {
					type: 'percentage',
					data: {
						labels: chart.labels,
						datasets: chart.datasets
					},
					truncateLegends: 1,
					barOptions: {
						height: 11,
						depth: 1
					},
					height: 200,
					maxSlices: 8,
					colors: ['purple', 'blue', 'cyan', 'teal', 'pink', 'red', 'orange', 'yellow'],
				});
			} else {
				this.wrapper.find('.percentage-chart-container').hide();
			}
		});
	}

	create_line_chart_filters() {
		let filters = [
			{
				label: 'All',
				options: ['All', 'Auto', 'Criticism', 'Appreciation', 'Revert'],
				action: (selected_item) => {
					if (selected_item === 'All') {
						this.line_chart_filters = [
							['Energy Point Log', 'user', '=', this.user_id, false],
							['Energy Point Log', 'type', '!=', 'Review', false]
						];
					} else {
						this.line_chart_filters[1] = ['Energy Point Log', 'type', '=', selected_item, false];
					}
					this.update_line_chart_data();
				}
			},
			{
				label: 'Last Month',
				options: ['Last Week', 'Last Month', 'Last Quarter', 'Last Year'],
				action: (selected_item) => {
					this.line_chart_config.timespan = selected_item;
					this.update_line_chart_data();
				}
			},
			{
				label: 'Daily',
				options: ['Daily', 'Weekly', 'Monthly'],
				action: (selected_item) => {
					this.line_chart_config.time_interval = selected_item;
					this.update_line_chart_data();
				}
			},
		];
		frappe.dashboard_utils.render_chart_filters(filters, 'chart-filter', '.line-chart-options', 1);
	}

	create_percentage_chart_filters() {
		let filters = [
			{
				label: 'Type',
				options: ['Type', 'Reference Doctype', 'Rule'],
				fieldnames: ['type', 'reference_doctype', 'rule'],
				action: (selected_item, fieldname) => {
					let title = selected_item + ' Distribution';
					this.render_percentage_chart(fieldname, title);
				}
			},
		];
		frappe.dashboard_utils.render_chart_filters(filters, 'chart-filter', '.percentage-chart-options');
	}

	create_heatmap_chart_filters() {
		let filters = [
			{
				label: frappe.dashboard_utils.get_year(frappe.datetime.now_date()),
				options: frappe.dashboard_utils.get_years_since_creation(frappe.boot.user.creation),
				action: (selected_item) => {
					this.update_heatmap_data(frappe.datetime.obj_to_str(selected_item));
				}
			},
		];
		frappe.dashboard_utils.render_chart_filters(filters, 'chart-filter', '.heatmap-options');
	}


	edit_profile() {
		let edit_profile_dialog = new frappe.ui.Dialog({
			title: __('Edit Profile'),
			fields: [
				{
					fieldtype: 'Attach Image',
					fieldname: 'user_image',
					label: 'Profile Image',
				},
				{
					fieldtype: 'Data',
					fieldname: 'interest',
					label: 'Interests',
				},
				{
					fieldtype: 'Column Break'
				},
				{
					fieldtype: 'Data',
					fieldname: 'location',
					label: 'Location',
				},
				{
					fieldtype: 'Section Break',
					fieldname: 'Interest',
				},
				{
					fieldtype: 'Small Text',
					fieldname: 'bio',
					label: 'Bio',
				}
			],
			primary_action: values => {
				edit_profile_dialog.disable_primary_action();
				frappe.xcall('frappe.desk.page.user_profile.user_profile.update_profile_info', {
					profile_info: values
				}).then(user => {
					user.image = user.user_image;
					this.user = Object.assign(values, user);
					edit_profile_dialog.hide();
					this.render_user_details();
				}).finally(() => {
					edit_profile_dialog.enable_primary_action();
				});
			},
			primary_action_label: __('Save')
		});

		edit_profile_dialog.set_values({
			user_image: this.user.image,
			location: this.user.location,
			interest: this.user.interest,
			bio: this.user.bio
		});
		edit_profile_dialog.show();
	}

	render_user_details() {
		this.sidebar.empty().append(frappe.render_template('user_profile_sidebar', {
			user_image: this.user.image,
			user_abbr: this.user.abbr,
			user_location: this.user.location,
			user_interest: this.user.interest,
			user_bio: this.user.bio,
		}));

		this.setup_user_profile_links();
	}

	setup_user_profile_links() {
		if (this.user_id !== frappe.session.user) {
			this.wrapper.find('.profile-links').hide();
		} else {
			this.wrapper.find('.edit-profile-link').on('click', () => {
				this.edit_profile();
			});

			this.wrapper.find('.user-settings-link').on('click', () => {
				this.go_to_user_settings();
			});
		}
	}

	get_user_rank() {
		return frappe.xcall('frappe.desk.page.user_profile.user_profile.get_user_rank', {
			user: this.user_id,
		}).then(r => {
			if (r.monthly_rank.length) this.month_rank = r.monthly_rank[0];
			if (r.all_time_rank.length) this.rank = r.all_time_rank[0];
		});
	}

	get_user_points() {
		return frappe.xcall(
			'frappe.social.doctype.energy_point_log.energy_point_log.get_user_energy_and_review_points',
			{
				user: this.user_id,
			}
		).then(r => {
			if (r[this.user_id]) {
				this.energy_points = r[this.user_id].energy_points;
				this.review_points = r[this.user_id].review_points;
			}
		});
	}

	render_points_and_rank() {
		let $profile_details = this.wrapper.find('.user-stats');
		let $profile_details_wrapper = this.wrapper.find('.user-stats-detail');

		const _get_stat_dom = (value, label, icon) => {
			return `<div class="user-stats-item mt-4">
						${frappe.utils.icon(icon, "lg", "no-stroke")}
						<div>
							<div class="stat-value">${value}</div>
							<div class="stat-label">${label}</div>
						</div>
					</div>`
		}

		this.get_user_rank().then(() => {
			this.get_user_points().then(() => {
				let html = $(`
					${_get_stat_dom(this.energy_points, __('Energy Points'), "color-energy-points")}
					${_get_stat_dom(this.review_points, __('Review Points'), "color-review-points")}
					${_get_stat_dom(this.rank, __('Rank'), "color-rank")}
					${_get_stat_dom(this.month_rank, __('Monthly Rank'), "color-monthly-rank")}
				`);

				$profile_details.append(html);
				$profile_details_wrapper.removeClass("hide");
			});
		});
	}

	go_to_user_settings() {
		frappe.set_route('Form', 'User', this.user_id);
	}

	render_user_activity() {
		this.$recent_activity_list = this.wrapper.find('.recent-activity-list');

		frappe.xcall('frappe.desk.page.user_profile.user_profile.get_energy_points_list', {
			start: this.activity_start,
			limit: this.activity_end,
			user: this.user_id
		}).then(list => {
			if (!list.length) return;
			this.activities_timeline = new BaseTimeline({
				parent: this.$recent_activity_list
			});
			this.activities_timeline.prepare_timeline_contents = () => {
				this.activities_timeline.timeline_items = list.map((data) => {
					return {
						creation: data.creation,
						card: true,
						content: frappe.energy_points.format_history_log(data),
					};
				});
			};
			this.activities_timeline.refresh();
		});


	}

	setup_show_more_activity() {
		//Show 10 items at a time
		this.activity_start = 0;
		this.activity_end = 11;
		this.wrapper.find('.show-more-activity').on('click', () => this.show_more_activity());
	}

	show_more_activity() {
		this.activity_start = this.activity_end;
		this.activity_end += 11;
		this.render_user_activity();
	}

}

frappe.provide('frappe.ui');
frappe.ui.UserProfile = UserProfile;