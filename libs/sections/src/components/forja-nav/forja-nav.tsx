import { Component, Prop, State, Event, EventEmitter, h } from '@stencil/core';
import type { NavItem, LocaleOption } from '../../types';

@Component({ tag: 'forja-nav', shadow: false })
export class ForjaNav {
  @Prop() siteName?: string;
  @Prop() homeHref?: string = '/';
  @Prop() items?: NavItem[];
  @Prop() locales?: LocaleOption[];
  @Prop() currentLocale?: string;
  @Prop() showThemeToggle?: boolean = true;

  @State() mobileOpen = false;
  @State() localeDropdownOpen = false;

  @Event() forjaThemeToggle!: EventEmitter<void>;
  @Event() forjaLocaleChange!: EventEmitter<string>;

  private toggleMobile = () => {
    this.mobileOpen = !this.mobileOpen;
  };

  private toggleLocaleDropdown = () => {
    this.localeDropdownOpen = !this.localeDropdownOpen;
  };

  private selectLocale = (code: string) => {
    this.localeDropdownOpen = false;
    this.forjaLocaleChange.emit(code);
  };

  private handleThemeToggle = () => {
    this.forjaThemeToggle.emit();
  };

  private renderNavLink(item: NavItem) {
    return (
      <a
        href={item.href}
        target={item.openInNewTab ? '_blank' : undefined}
        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
        class="forja-nav__link"
      >
        {item.title}
      </a>
    );
  }

  private renderDesktopItem(item: NavItem) {
    if (item.children && item.children.length > 0) {
      return (
        <div class="forja-nav__dropdown">
          <a
            href={item.href}
            target={item.openInNewTab ? '_blank' : undefined}
            rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
            class="forja-nav__link"
          >
            {item.title}
          </a>
          <div class="forja-nav__dropdown-menu">
            {item.children.map(child => (
              <a
                href={child.href}
                target={child.openInNewTab ? '_blank' : undefined}
                rel={child.openInNewTab ? 'noopener noreferrer' : undefined}
                class="forja-nav__dropdown-item"
              >
                {child.title}
              </a>
            ))}
          </div>
        </div>
      );
    }
    return this.renderNavLink(item);
  }

  private renderThemeToggle() {
    if (!this.showThemeToggle) return null;
    return (
      <button
        type="button"
        aria-label="Toggle dark mode"
        class="forja-nav__theme-toggle"
        onClick={this.handleThemeToggle}
      >
        <svg class="forja-nav__icon-moon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/></svg>
        <svg class="forja-nav__icon-sun" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      </button>
    );
  }

  private renderLocaleSwitcher() {
    if (!this.locales || this.locales.length <= 1) return null;
    return (
      <div class="forja-nav__locale-switcher">
        <button
          type="button"
          aria-label="Switch language"
          class="forja-nav__locale-toggle"
          onClick={this.toggleLocaleDropdown}
        >
          {this.currentLocale || 'en'}
        </button>
        {this.localeDropdownOpen && (
          <div class="forja-nav__locale-dropdown">
            {this.locales.map(locale => (
              <button
                type="button"
                class={`forja-nav__locale-option${locale.code === this.currentLocale ? ' forja-nav__locale-option--active' : ''}`}
                onClick={() => this.selectLocale(locale.code)}
              >
                {locale.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  render() {
    const navItems = this.items || [];

    return (
      <nav class="forja-nav" aria-label="Main navigation">
        <div class="forja-nav__container">
          {this.siteName && (
            <a href={this.homeHref} class="forja-nav__brand">{this.siteName}</a>
          )}

          {/* Desktop */}
          <div class="forja-nav__desktop">
            {navItems.map(item => this.renderDesktopItem(item))}
            {this.renderLocaleSwitcher()}
            {this.renderThemeToggle()}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label="Toggle navigation"
            class="forja-nav__hamburger"
            onClick={this.toggleMobile}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>

        {/* Mobile menu */}
        {this.mobileOpen && (
          <div class="forja-nav__mobile">
            {navItems.map(item => (
              <a
                href={item.href}
                target={item.openInNewTab ? '_blank' : undefined}
                rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                class="forja-nav__mobile-link"
              >
                {item.title}
              </a>
            ))}
            {this.renderThemeToggle()}
          </div>
        )}
      </nav>
    );
  }
}
