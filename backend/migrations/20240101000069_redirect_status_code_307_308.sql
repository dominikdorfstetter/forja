-- Widen the redirect status_code domain from {301, 302} to
-- {301, 302, 307, 308}. Pins the contract documented on
-- `RedirectLookupResponse` (issue #743): consumers may rely on
-- status_code being one of these four values without runtime coercion.
--
-- 307 (Temporary Redirect) and 308 (Permanent Redirect) preserve the
-- request method, which 301/302 historically did not — needed for
-- redirecting POST/PUT under modern semantics.
ALTER TABLE redirects
    DROP CONSTRAINT chk_redirect_status_code,
    ADD CONSTRAINT chk_redirect_status_code
        CHECK (status_code IN (301, 302, 307, 308));
