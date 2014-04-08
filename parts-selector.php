<?php
/*
Plugin Name: Parts Selector
Description: custom page with angularjs driven parts selector table
Version: 1.0
*/

register_activation_hook(__FILE__,'parts_selector_plugin_install');
register_deactivation_hook(__FILE__,'parts_selector_plugin_remove');

function parts_selector_plugin_install() {
  global $wpdb;

  $page_title = 'Parts Builder';
  $page_name = 'parts-builder';

  // the menu entry...
  delete_option("parts_selector_page_title");
  add_option("parts_selector_page_title", $page_title, '', 'yes');
  // the slug...
  delete_option("parts_selector_page_name");
  add_option("parts_selector_page_name", $page_name, '', 'yes');
  // the id...
  delete_option("parts_selector_page_id");
  add_option("parts_selector_page_id", '0', '', 'yes');

  $page = get_page_by_title( $page_title );

  if ( ! $page ) {
    // Create post object
    $_p = array();
    $_p['post_title'] = $page_title;
    $_p['post_content'] = "This text may be overridden by the plugin. You shouldn't edit it.";
    $_p['post_status'] = 'publish';
    $_p['post_type'] = 'page';
    $_p['comment_status'] = 'closed';
    $_p['ping_status'] = 'closed';
    $_p['post_category'] = array(1); // the default 'Uncatrgorised'

    // Insert the post into the database
    $page_id = wp_insert_post( $_p );
  }
  else {
    // the plugin may have been previously active and the page may just be trashed...
    $page_id = $page->ID;
    //make sure the page is not trashed...
    $page->post_status = 'publish';
    $page_id = wp_update_post( $the_page );
  }

  delete_option( 'parts_selector_page_id' );
  add_option( 'parts_selector_page_id', $page_id );
}

function parts_selector_plugin_remove() {
  global $wpdb;

  $page_title = get_option( 'parts_selector_page_title' );
  $page_name = get_option( 'parts_selector_page_name' );

  //  the id of our page...
  $page_id = get_option( 'parts_selector_page_id' );
  if( $page_id ) {
    wp_delete_post( $page_id ); // this will trash, not delete
  }

  delete_option("parts_selector_page_title");
  delete_option("parts_selector_page_name");
  delete_option("parts_selector_page_id");
}

function parts_selector_query_parser( $q ) {
  $page_name = get_option( 'parts_selector_page_name');
  $page_id = get_option( 'parts_selector_page_id' );

  $qv = $q->query_vars;

  if( !$q->did_permalink and ( isset($q->query_vars['page_id']) and intval($q->query_vars['page_id']) == $page_id) ) {
    $q->set( 'parts_selector_page_is_called', TRUE );
    return $q;
  } elseif ( isset($q->query_vars['pagename']) and ( ($q->query_vars['pagename'] == $page_name)) or (($_pos_found = strpos($q->query_vars['pagename'],$page_name.'/') === 0)) ) {
    $q->set('parts_selector_page_is_called', TRUE );
    return $q;
  } else {
    $q->set('parts_selector_page_is_called', FALSE );
    return $q;
  }
}

add_filter( 'parse_query', 'parts_selector_query_parser' );

function parts_selector_page_filter( $posts ) {
  global $wp_query;

  if( $wp_query->get('parts_selector_page_is_called') ) {
    add_frontend_scripts();
    load_angular_javascript();

    $posts[0]->post_title = get_option( 'parts_selector_page_title' );
    $posts[0]->post_content = '<div class="app-main" ng-app="app"><div ng-view></div></div>';
  }

  return $posts;
}
add_filter( 'the_posts', 'parts_selector_page_filter' );


function load_angular_javascript()
{
    /*Loading angular*/
    wp_enqueue_script('angular-js', plugin_dir_url(__FILE__) . 'lib/angular-1.3.0/angular.min.js');
    wp_enqueue_script('angular-js-route', plugin_dir_url(__FILE__) . 'lib/angular-1.3.0/angular-route.js');
    wp_enqueue_script('angular-js-sanitize', plugin_dir_url(__FILE__) . 'lib/angular-1.3.0/angular-sanitize.js');
    wp_enqueue_script('angular-js-utils', plugin_dir_url(__FILE__) . 'lib/ui-utils-0.1.1/ui-utils.min.js');

    wp_enqueue_script('angular-parts-selector-app', plugin_dir_url(__FILE__) . 'app/app.js');
}

function add_frontend_scripts() {
  wp_enqueue_script('jquery');
  wp_enqueue_script('jquery-ui-core');
  wp_enqueue_script('jquery-ui-datepicker');
  wp_enqueue_script('underscore');
  wp_enqueue_script('maskMoney', get_bloginfo('template_directory') . '/js/vendor/jquery.maskMoney.min.js');
  wp_enqueue_script('jquery_form', get_bloginfo('template_directory') . '/js/vendor/jquery.form.min.js');
}

add_action( 'init', 'parts_selector_init_internal' );
function parts_selector_init_internal()
{
    add_rewrite_rule( 'get_product_id$', 'index.php?get_part_number_id=$matches[1]', 'top' );
    add_rewrite_rule( 'check_product_parts$', 'index.php?check_product_parts=$matches[1]', 'top' );
}

add_filter( 'query_vars', 'parts_selector_query_vars' );
function parts_selector_query_vars( $query_vars )
{
    $query_vars[] = 'get_part_number_id';
    $query_vars[] = 'check_product_parts';
    return $query_vars;
}

add_action( 'parse_request', 'parts_selector_parse_request' );
function parts_selector_parse_request( &$wp )
{
    global $wpdb;
    if( array_key_exists( 'get_part_number_id', $wp->query_vars ) ) {
      $part_number = $wp->query_vars['get_part_number_id'];
      $result = $wpdb->get_results(
        "select product_id from wp_aeroflite_products where number = '$part_number'"
      );

      if(!empty($result)) {
        header("Content-Type: application/javascript");
        echo $result[0]->product_id;
      } else {
        header("Content-Type: application/javascript");
        echo '';
      }
        exit();
    }

    if( array_key_exists( 'check_product_parts', $wp->query_vars ) ) {
      $part_number = $wp->query_vars['check_product_parts'];
      $result = $wpdb->get_results(
        "select product_id from wp_aeroflite_products where number like '$part_number%'"
      );
      if(!empty($result)) {
        header("Content-Type: application/javascript");
        echo true;
      } else {
        header("Content-Type: application/javascript");
        echo false;
      }

      exit();
    }

    return;
}
?>
