#pragma once
/**
 * Bantu Language - Variable Environment (Scope Chain)
 */

#include "types.hpp"
#include <memory>
#include <unordered_map>

class Environment {
public:
    std::unordered_map<std::string, Value> variables;
    std::shared_ptr<Environment> parent;

    explicit Environment(std::shared_ptr<Environment> parentEnv = nullptr)
        : parent(std::move(parentEnv)) {}

    void define(const std::string& name, const Value& value) {
        variables[name] = value;
    }

    Value get(const std::string& name) {
        auto it = variables.find(name);
        if (it != variables.end()) return it->second;
        if (parent) return parent->get(name);
        ErrorHandler::throwReferenceError("Undefined variable: " + name);
        return Value();
    }

    Value& getRef(const std::string& name) {
        auto it = variables.find(name);
        if (it != variables.end()) return it->second;
        if (parent) return parent->getRef(name);
        ErrorHandler::throwReferenceError("Undefined variable: " + name);
        static Value nullVal;
        return nullVal;
    }

    void set(const std::string& name, const Value& value) {
        auto it = variables.find(name);
        if (it != variables.end()) { it->second = value; return; }
        if (parent) { parent->set(name, value); return; }
        ErrorHandler::throwReferenceError("Undefined variable: " + name);
    }

    bool has(const std::string& name) const {
        auto it = variables.find(name);
        if (it != variables.end()) return true;
        if (parent) return parent->has(name);
        return false;
    }
};
