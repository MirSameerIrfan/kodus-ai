variable "DOCKERFILE" {
  default = "docker/Dockerfile"
}

variable "RELEASE_VERSION" {
  default = "local"
}

variable "API_CLOUD_MODE" {
  default = "true"
}

variable "CACHE_SCOPE" {
  default = "kodus-ai-arm64"
}

target "base" {
  context = "."
  dockerfile = "${DOCKERFILE}"
  args = {
    RELEASE_VERSION = "${RELEASE_VERSION}"
    API_CLOUD_MODE = "${API_CLOUD_MODE}"
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
