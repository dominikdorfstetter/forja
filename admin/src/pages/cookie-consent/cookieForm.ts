/** Form values of the cookie group and cookie item dialogs; items ignore `default_enabled`. */
export interface CookieFormData {
  cookie_name: string;
  is_required: boolean;
  default_enabled: boolean;
}

export const EMPTY_COOKIE_FORM: CookieFormData = { cookie_name: '', is_required: false, default_enabled: false };
