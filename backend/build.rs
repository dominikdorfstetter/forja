use std::env;
use std::path::Path;
use std::process::Command;

fn main() {
    // Only build admin when the bundle-admin feature is active
    if env::var("CARGO_FEATURE_BUNDLE_ADMIN").is_err() {
        return;
    }

    let admin_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../admin");

    // Smart rebuild: only re-run if admin sources change
    println!("cargo:rerun-if-changed=../admin/src");
    println!("cargo:rerun-if-changed=../admin/package.json");
    println!("cargo:rerun-if-changed=../admin/vite.config.ts");
    println!("cargo:rerun-if-changed=../admin/tsconfig.json");
    println!("cargo:rerun-if-changed=../admin/index.html");

    println!("cargo:warning=Installing admin dependencies...");

    let npm = if cfg!(target_os = "windows") {
        "npm.cmd"
    } else {
        "npm"
    };

    let install = Command::new(npm)
        .arg("install")
        .current_dir(&admin_dir)
        .status();

    match install {
        Ok(status) if status.success() => {}
        Ok(status) => {
            panic!(
                "npm install failed with exit code: {}",
                status.code().unwrap_or(-1)
            );
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            println!("cargo:warning=npm not found — skipping admin build. Install Node.js to use --features bundle-admin");
            return;
        }
        Err(e) => {
            panic!("Failed to run npm install: {e}");
        }
    }

    println!("cargo:warning=Building admin dashboard...");

    let build = Command::new(npm)
        .args(["run", "build"])
        .current_dir(&admin_dir)
        .status();

    match build {
        Ok(status) if status.success() => {
            println!("cargo:warning=Admin dashboard built successfully.");
        }
        Ok(status) => {
            panic!(
                "npm run build failed with exit code: {}",
                status.code().unwrap_or(-1)
            );
        }
        Err(e) => {
            panic!("Failed to run npm run build: {e}");
        }
    }
}
