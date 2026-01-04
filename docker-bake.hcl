variable "DOCKERFILE" {
  default = "docker/Dockerfile"
}

variable "RELEASE_VERSION" {
  default = "local"
}

variable "CACHE_SCOPE" {
  default = "kodus-ai-arm64"
}

variable "PLATFORM" {
  default = "linux/arm64"
}

target "base" {
  context = "."
  dockerfile = "${DOCKERFILE}"
  platforms = ["${PLATFORM}"]
  args = {
    RELEASE_VERSION = "${RELEASE_VERSION}"
  }
  cache-from = ["type=gha,scope=${CACHE_SCOPE}"]
  cache-to = ["type=gha,scope=${CACHE_SCOPE},mode=max"]
}

target "api" {
  inherits = ["base"]
  target = "api"
}

target "webhooks" {
  inherits = ["base"]
  target = "webhooks"
}

target "worker" {
  inherits = ["base"]
  target = "worker"
}

group "default" {
  targets = ["api", "webhooks", "worker"]
}
