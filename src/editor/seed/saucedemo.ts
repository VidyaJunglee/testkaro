// ─── Seed Data: SauceDemo Test Suite ──────────────────────────────────────────
// Pre-built test modules for https://www.saucedemo.com
// 4 modules, 14 tests, 80+ steps covering auth, catalog, cart, checkout

import { ModuleFile } from '../../schema';

export const SAUCEDEMO_MODULES: ModuleFile[] = [
  {
    id: 'mod-auth',
    name: 'Authentication',
    description: 'Login, logout, locked user, invalid credentials',
    order: 0,
    tests: [
      {
        id: 'auth-valid-login',
        name: 'Valid Login',
        steps: [
          { id: 'a1', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 'a2', type: 'fill', params: { selector: '#user-name', value: 'standard_user' } },
          { id: 'a3', type: 'fill', params: { selector: '#password', value: 'secret_sauce' } },
          { id: 'a4', type: 'click', params: { selector: '#login-button' } },
          { id: 'a5', type: 'assert_url', params: { expected: '/inventory.html', mode: 'contains' } },
          { id: 'a6', type: 'assert_visible', params: { selector: '.inventory_list' } },
        ],
      },
      {
        id: 'auth-invalid-login',
        name: 'Invalid Login - Wrong Password',
        steps: [
          { id: 'a7', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 'a8', type: 'fill', params: { selector: '#user-name', value: 'standard_user' } },
          { id: 'a9', type: 'fill', params: { selector: '#password', value: 'wrong_password' } },
          { id: 'a10', type: 'click', params: { selector: '#login-button' } },
          { id: 'a11', type: 'assert_visible', params: { selector: '[data-test="error"]' } },
          { id: 'a12', type: 'assert_text', params: { selector: '[data-test="error"]', expected: 'Username and password do not match', exact: false } },
        ],
      },
      {
        id: 'auth-locked-user',
        name: 'Locked Out User',
        steps: [
          { id: 'a13', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 'a14', type: 'fill', params: { selector: '#user-name', value: 'locked_out_user' } },
          { id: 'a15', type: 'fill', params: { selector: '#password', value: 'secret_sauce' } },
          { id: 'a16', type: 'click', params: { selector: '#login-button' } },
          { id: 'a17', type: 'assert_text', params: { selector: '[data-test="error"]', expected: 'locked out', exact: false } },
        ],
      },
      {
        id: 'auth-logout',
        name: 'Logout',
        steps: [
          { id: 'a18', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 'a19', type: 'fill', params: { selector: '#user-name', value: 'standard_user' } },
          { id: 'a20', type: 'fill', params: { selector: '#password', value: 'secret_sauce' } },
          { id: 'a21', type: 'click', params: { selector: '#login-button' } },
          { id: 'a22', type: 'click', params: { selector: '#react-burger-menu-btn' } },
          { id: 'a23', type: 'wait_for_element', params: { selector: '#logout_sidebar_link', timeout: 3000 } },
          { id: 'a24', type: 'click', params: { selector: '#logout_sidebar_link' } },
          { id: 'a25', type: 'assert_url', params: { expected: 'https://www.saucedemo.com/', mode: 'equals' } },
        ],
      },
    ],
  },
  {
    id: 'mod-catalog',
    name: 'Product Catalog',
    description: 'Product listing, sorting, product detail page',
    order: 1,
    tests: [
      {
        id: 'catalog-list-products',
        name: 'Verify Products Listed',
        steps: [
          { id: 'c1', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 'c2', type: 'fill', params: { selector: '#user-name', value: 'standard_user' } },
          { id: 'c3', type: 'fill', params: { selector: '#password', value: 'secret_sauce' } },
          { id: 'c4', type: 'click', params: { selector: '#login-button' } },
          { id: 'c5', type: 'assert_text', params: { selector: '.title', expected: 'Products', exact: true } },
          { id: 'c6', type: 'assert_count', params: { selector: '.inventory_item', count: 6 } },
        ],
      },
      {
        id: 'catalog-sort-price-low-high',
        name: 'Sort by Price Low to High',
        steps: [
          { id: 'c7', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 'c8', type: 'fill', params: { selector: '#user-name', value: 'standard_user' } },
          { id: 'c9', type: 'fill', params: { selector: '#password', value: 'secret_sauce' } },
          { id: 'c10', type: 'click', params: { selector: '#login-button' } },
          { id: 'c11', type: 'select', params: { selector: '[data-test="product-sort-container"]', value: 'lohi' } },
          { id: 'c12', type: 'get_text', params: { selector: '.inventory_item:first-child .inventory_item_price', saveAs: 'firstPrice' } },
          { id: 'c13', type: 'assert_text', params: { selector: '.inventory_item:first-child .inventory_item_price', expected: '$7.99', exact: true } },
        ],
      },
      {
        id: 'catalog-sort-name-za',
        name: 'Sort by Name Z to A',
        steps: [
          { id: 'c14', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 'c15', type: 'fill', params: { selector: '#user-name', value: 'standard_user' } },
          { id: 'c16', type: 'fill', params: { selector: '#password', value: 'secret_sauce' } },
          { id: 'c17', type: 'click', params: { selector: '#login-button' } },
          { id: 'c18', type: 'select', params: { selector: '[data-test="product-sort-container"]', value: 'za' } },
          { id: 'c19', type: 'assert_text', params: { selector: '.inventory_item:first-child .inventory_item_name', expected: 'Test.allTheThings() T-Shirt (Red)', exact: true } },
        ],
      },
      {
        id: 'catalog-product-detail',
        name: 'View Product Details',
        steps: [
          { id: 'c20', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 'c21', type: 'fill', params: { selector: '#user-name', value: 'standard_user' } },
          { id: 'c22', type: 'fill', params: { selector: '#password', value: 'secret_sauce' } },
          { id: 'c23', type: 'click', params: { selector: '#login-button' } },
          { id: 'c24', type: 'click', params: { selector: '#item_4_title_link' } },
          { id: 'c25', type: 'assert_text', params: { selector: '.inventory_details_name', expected: 'Sauce Labs Backpack', exact: true } },
          { id: 'c26', type: 'assert_visible', params: { selector: '.inventory_details_img' } },
          { id: 'c27', type: 'assert_text', params: { selector: '.inventory_details_price', expected: '$29.99', exact: true } },
        ],
      },
    ],
  },
  {
    id: 'mod-cart',
    name: 'Shopping Cart',
    description: 'Add items, remove items, cart badge count',
    order: 2,
    tests: [
      {
        id: 'cart-add-item',
        name: 'Add Single Item to Cart',
        steps: [
          { id: 't1', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 't2', type: 'fill', params: { selector: '#user-name', value: 'standard_user' } },
          { id: 't3', type: 'fill', params: { selector: '#password', value: 'secret_sauce' } },
          { id: 't4', type: 'click', params: { selector: '#login-button' } },
          { id: 't5', type: 'click', params: { selector: '[data-test="add-to-cart-sauce-labs-backpack"]' } },
          { id: 't6', type: 'assert_text', params: { selector: '.shopping_cart_badge', expected: '1', exact: true } },
          { id: 't7', type: 'click', params: { selector: '.shopping_cart_link' } },
          { id: 't8', type: 'assert_text', params: { selector: '.inventory_item_name', expected: 'Sauce Labs Backpack', exact: true } },
        ],
      },
      {
        id: 'cart-add-multiple',
        name: 'Add Multiple Items to Cart',
        steps: [
          { id: 't9', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 't10', type: 'fill', params: { selector: '#user-name', value: 'standard_user' } },
          { id: 't11', type: 'fill', params: { selector: '#password', value: 'secret_sauce' } },
          { id: 't12', type: 'click', params: { selector: '#login-button' } },
          { id: 't13', type: 'click', params: { selector: '[data-test="add-to-cart-sauce-labs-backpack"]' } },
          { id: 't14', type: 'click', params: { selector: '[data-test="add-to-cart-sauce-labs-bike-light"]' } },
          { id: 't15', type: 'click', params: { selector: '[data-test="add-to-cart-sauce-labs-bolt-t-shirt"]' } },
          { id: 't16', type: 'assert_text', params: { selector: '.shopping_cart_badge', expected: '3', exact: true } },
          { id: 't17', type: 'click', params: { selector: '.shopping_cart_link' } },
          { id: 't18', type: 'assert_count', params: { selector: '.cart_item', count: 3 } },
        ],
      },
      {
        id: 'cart-remove-item',
        name: 'Remove Item from Cart',
        steps: [
          { id: 't19', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 't20', type: 'fill', params: { selector: '#user-name', value: 'standard_user' } },
          { id: 't21', type: 'fill', params: { selector: '#password', value: 'secret_sauce' } },
          { id: 't22', type: 'click', params: { selector: '#login-button' } },
          { id: 't23', type: 'click', params: { selector: '[data-test="add-to-cart-sauce-labs-backpack"]' } },
          { id: 't24', type: 'click', params: { selector: '.shopping_cart_link' } },
          { id: 't25', type: 'click', params: { selector: '[data-test="remove-sauce-labs-backpack"]' } },
          { id: 't26', type: 'assert_count', params: { selector: '.cart_item', count: 0 } },
        ],
      },
    ],
  },
  {
    id: 'mod-checkout',
    name: 'Checkout Flow',
    description: 'Complete checkout, validation errors, cancel flow',
    order: 3,
    tests: [
      {
        id: 'checkout-complete',
        name: 'Complete Checkout Successfully',
        steps: [
          { id: 'k1', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 'k2', type: 'fill', params: { selector: '#user-name', value: 'standard_user' } },
          { id: 'k3', type: 'fill', params: { selector: '#password', value: 'secret_sauce' } },
          { id: 'k4', type: 'click', params: { selector: '#login-button' } },
          { id: 'k5', type: 'click', params: { selector: '[data-test="add-to-cart-sauce-labs-backpack"]' } },
          { id: 'k6', type: 'click', params: { selector: '.shopping_cart_link' } },
          { id: 'k7', type: 'click', params: { selector: '[data-test="checkout"]' } },
          { id: 'k8', type: 'fill', params: { selector: '[data-test="firstName"]', value: 'John' } },
          { id: 'k9', type: 'fill', params: { selector: '[data-test="lastName"]', value: 'Doe' } },
          { id: 'k10', type: 'fill', params: { selector: '[data-test="postalCode"]', value: '12345' } },
          { id: 'k11', type: 'click', params: { selector: '[data-test="continue"]' } },
          { id: 'k12', type: 'assert_text', params: { selector: '.summary_total_label', expected: '$32.39', exact: false } },
          { id: 'k13', type: 'click', params: { selector: '[data-test="finish"]' } },
          { id: 'k14', type: 'assert_text', params: { selector: '.complete-header', expected: 'Thank you for your order!', exact: true } },
        ],
      },
      {
        id: 'checkout-missing-info',
        name: 'Checkout with Missing Info',
        steps: [
          { id: 'k15', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 'k16', type: 'fill', params: { selector: '#user-name', value: 'standard_user' } },
          { id: 'k17', type: 'fill', params: { selector: '#password', value: 'secret_sauce' } },
          { id: 'k18', type: 'click', params: { selector: '#login-button' } },
          { id: 'k19', type: 'click', params: { selector: '[data-test="add-to-cart-sauce-labs-backpack"]' } },
          { id: 'k20', type: 'click', params: { selector: '.shopping_cart_link' } },
          { id: 'k21', type: 'click', params: { selector: '[data-test="checkout"]' } },
          { id: 'k22', type: 'click', params: { selector: '[data-test="continue"]' } },
          { id: 'k23', type: 'assert_visible', params: { selector: '[data-test="error"]' } },
          { id: 'k24', type: 'assert_text', params: { selector: '[data-test="error"]', expected: 'First Name is required', exact: false } },
        ],
      },
      {
        id: 'checkout-cancel',
        name: 'Cancel Checkout Returns to Cart',
        steps: [
          { id: 'k25', type: 'navigate', params: { url: 'https://www.saucedemo.com' } },
          { id: 'k26', type: 'fill', params: { selector: '#user-name', value: 'standard_user' } },
          { id: 'k27', type: 'fill', params: { selector: '#password', value: 'secret_sauce' } },
          { id: 'k28', type: 'click', params: { selector: '#login-button' } },
          { id: 'k29', type: 'click', params: { selector: '[data-test="add-to-cart-sauce-labs-backpack"]' } },
          { id: 'k30', type: 'click', params: { selector: '.shopping_cart_link' } },
          { id: 'k31', type: 'click', params: { selector: '[data-test="checkout"]' } },
          { id: 'k32', type: 'click', params: { selector: '[data-test="cancel"]' } },
          { id: 'k33', type: 'assert_url', params: { expected: '/cart.html', mode: 'contains' } },
        ],
      },
    ],
  },
];

export const SAUCEDEMO_APP_NAME = 'SauceDemo Test Suite';
export const SAUCEDEMO_DESCRIPTION = 'End-to-end tests for saucedemo.com covering authentication, product catalog, shopping cart, and checkout flows.';
