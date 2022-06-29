## Deploying FarosCE on Kubernetes

We provide all required Kubernetes manifests for a full stack deployment in this repository under `kube/base`. These manifests can be used raw but are also exposed using [Kustomize](https://kustomize.io/) for a more flexible and scalable deployment model.

> Local Kubernetes clusters can be setup in a few different ways. Here's a list of the few most common tools for local K8s deployment: [kind](https://kind.sigs.k8s.io/), [k3d](https://k3d.io/v5.4.3/) or [minikube](https://minikube.sigs.k8s.io/docs/start/).

Provided you have have access to a Kubernetes cluster and have configured access to it via `kubectl`, FarosCE can be deployed with the following command:

```base
kubectl apply -k https://github.com/faros-ai/faros-community-edition/kube/base
```

Kustomize will load the deployment definition in this repository over Github, build the manifests and pipe them over to `kubectl` for deployment in the configured cluster.

To access the deployed applications you can port forward onto the relevant services, for example:

```yaml
# Expose Airbyte to localhost
kubectl port-forward svc/airbyte-webapp-svc 8000:80
# Expose Metabase to localhost
kubectl port-forward svc/metabase 3000:80
# Expose Hasura to localhost
kubectl port-forward svc/hasura 8080:80
# Expose N8N to localhost
kubectl port-forward svc/n8n 5678:80
```

> Kubernetes services can also be exposed using NodePort, Ingress, or External LoadBalancers. This will vary depending on your Kubernetes cluster.

### Using kustomization.yaml file

For a more declarative and GitOps friendly deployment approach you can create your own local `kustomization.yaml` file, put it under a source control system and reference the same path in the resources attribute.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - https://github.com/faros-ai/faros-community-edition/kube/base
```

> This allows you to customize the Kubernetes resources objects in any way you want to meet whatever desired cluster requirements you might have

With this file available you can run the following command from the same path to build and apply the manifests:

```yaml
kubectl apply -k https://github.com/faros-ai/faros-community-edition/kube/base
```

### Using local files

You can clone the repository, and then run:

```base
kubectl apply -k kube/base
```