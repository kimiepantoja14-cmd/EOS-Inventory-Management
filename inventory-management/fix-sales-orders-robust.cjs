const fs = require('fs');
let c = fs.readFileSync('src/components/SalesOrders.tsx', 'utf8');
const regex = /\s*?\{\/\* Interactive Machinery Explorer Modal - Extracted \*\/\}[\r\n\s]+?\{renderMachineSerialModal\(\)\}[\r\n\s]+?<\/div>[\r\n\s]+?<\/div>[\r\n\s]+?<\/div>[\r\n\s]+?\);[\r\n\s]+?\}\)\(\)\}/;
if (regex.test(c)) {
  c = c.replace(regex, `
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Machinery Explorer Modal - Dynamic */}
      {renderMachineSerialModal()}`);
  fs.writeFileSync('src/components/SalesOrders.tsx', c, 'utf8');
  console.log('Successfully aligned SalesOrders.tsx tags!');
} else {
  console.log('Regex did not match current content.');
}
