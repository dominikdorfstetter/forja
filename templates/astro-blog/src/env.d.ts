/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    locale: import('./lib/api').SiteLocale;
    locales: import('./lib/api').SiteLocale[];
  }
}
