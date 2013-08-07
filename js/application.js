(function($){
	var $window = $(window);

	// Disable certain links in docs
	$('section [href^=#]').click(function (e) {
	  e.preventDefault();
	})

	// side bar
	setTimeout(function () {
	  $('.bs-docs-sidenav').affix({
	    offset: {
	      top: function () { return $window.width() <= 980 ? 120 : 120 }
	    , bottom: 270
	    }
	  })
	}, 100);

	// make code pretty
	window.prettyPrint && prettyPrint();
	if($.fn.tableNav){
		$('.table-paged').each(function(){
			$(this).tableNav({
				itemsPerPage: $(this).data("tablePagesize") || 10
			});
		});
	}
	//Social Media
    $('#shareme').sharrre({
      share: {
        googlePlus: true,
        facebook: true,
        twitter: true,
        linkedin: true
      },
      buttons: {
        googlePlus: {size: 'tall', annotation:'bubble'},
        facebook: {layout: 'box_count'},
        twitter: {count: 'vertical'},
        linkedin: {counter: 'top'}
      },
      enableHover: true,
      enableCounter: false,
      enableTracking: true
    });
})(window.jQuery);
