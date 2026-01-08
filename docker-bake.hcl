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

variable "API_TAGS" {
  default = "kodus-ai-api:local"
}

variable "WEBHOOKS_TAGS" {
  default = "kodus-ai-webhook:local"
}

variable "WORKER_TAGS" {
  default = "kodus-ai-worker:local"
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
  tags = split(",", API_TAGS)
}

target "webhooks" {
  inherits = ["base"]
  target = "webhooks"
  tags = split(",", WEBHOOKS_TAGS)
}

target "worker" {
  inherits = ["base"]
  target = "worker"
  tags = split(",", WORKER_TAGS)
}

group "default" {
  targets = ["api", "webhooks", "worker"]
}
