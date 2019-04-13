$(function () {
  $(document).on('click', 'button.play', function (event) {
    const $button = $(event.target);
    const $parent = $(event.target.parentNode);
    const url = $button.data('url');
    const el = document.createElement('audio');
    el.src = url;
    el.controls = true;
    $parent.append(el);
    $button.remove();
    el.play();
  });
});
