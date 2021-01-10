# F5 Experience 


## Install Azure CLI following [this link](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)

## Sign in Azure via CLI and set the default subscription to your testing subscription
## Rename `Pulumi.devSample.yaml` to `Pulumi.dev.yaml`
## Modify `Pulumi.dev.yaml` with the proper arguments
- Project name need to be the same as in the`Pulumi.yaml` and `project.json`



# Make changes in `index.ts` and run command

- With standard output
  ```powershell 
    pulumi up --logtostderr -v=9 2> out.txt
  ```

- Without standard output
  ```powershell 
    pulumi up
  ```